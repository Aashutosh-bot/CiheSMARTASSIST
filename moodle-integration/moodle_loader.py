import os
import requests
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and makes its values available

MOODLE_URL = os.getenv("MOODLE_URL")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN")

# Comma-separated list of course IDs, e.g. "10,11,12,13,14"
_raw_course_ids = os.getenv("MOODLE_COURSE_IDS", "")
MOODLE_COURSE_IDS = [c.strip() for c in _raw_course_ids.split(",") if c.strip()]

# Accounts Moodle/MoodleCloud auto-creates that are not real students
IGNORED_EMAILS = {"noreply@moodlecloud.com"}


def _fetch_pages_for_course(course_id):
    """Fetch every 'Page' module's clean text from a single Moodle course."""
    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "core_course_get_contents",
        "moodlewsrestformat": "json",
        "courseid": course_id,
    }

    try:
        response = requests.post(endpoint, data=params, timeout=10)
        data = response.json()
    except Exception as e:
        print(f"[moodle_loader] Could not reach Moodle for course {course_id}: {e}")
        return []

    if isinstance(data, dict):
        print(f"[moodle_loader] Moodle error for course {course_id}: {data}")
        return []

    results = []
    for section in data:
        for module in section.get("modules", []):
            if module.get("modname") != "page":
                continue
            for item in module.get("contents", []):
                file_url = item.get("fileurl")
                if not file_url:
                    continue
                file_url_with_token = f"{file_url}&token={MOODLE_TOKEN}"
                file_response = requests.get(file_url_with_token, timeout=10)
                soup = BeautifulSoup(file_response.text, "html.parser")
                clean_text = soup.get_text(separator=" ", strip=True)
                source_name = f"moodle::course{course_id}::{module.get('name')}"
                results.append((source_name, clean_text))

    return results


def fetch_moodle_pages():
    """
    Connects to Moodle and pulls every 'Page' module's content across ALL
    configured courses (MOODLE_COURSE_IDS). Returns a list of
    (source_name, clean_text) tuples ready for chunking.
    Returns an empty list if Moodle is unreachable or no token/courses are
    configured, so the rest of the app keeps working regardless.
    """
    if not MOODLE_TOKEN:
        print("[moodle_loader] No MOODLE_TOKEN set in .env - skipping Moodle content.")
        return []

    if not MOODLE_COURSE_IDS:
        print("[moodle_loader] No MOODLE_COURSE_IDS set in .env - skipping Moodle content.")
        return []

    all_results = []
    for course_id in MOODLE_COURSE_IDS:
        course_results = _fetch_pages_for_course(course_id)
        print(f"[moodle_loader] Course {course_id}: fetched {len(course_results)} page(s)")
        all_results.extend(course_results)

    print(f"[moodle_loader] Total fetched: {len(all_results)} page(s) across {len(MOODLE_COURSE_IDS)} course(s)")
    return all_results


def fetch_moodle_assignments():
    """
    Returns a list of assignment dicts across all configured courses:
    { "course_id": ..., "assignment_id": ..., "name": ..., "due_date": "YYYY-MM-DD", "max_grade": ... }
    using the mod_assign_get_assignments Moodle function.
    """
    if not MOODLE_TOKEN or not MOODLE_COURSE_IDS:
        print("[moodle_loader] Missing token or course IDs - skipping assignments.")
        return []

    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "mod_assign_get_assignments",
        "moodlewsrestformat": "json",
    }
    for i, course_id in enumerate(MOODLE_COURSE_IDS):
        params[f"courseids[{i}]"] = course_id

    try:
        response = requests.post(endpoint, data=params, timeout=10)
        data = response.json()
    except Exception as e:
        print(f"[moodle_loader] Could not fetch assignments: {e}")
        return []

    if isinstance(data, dict) and "exception" in data:
        print(f"[moodle_loader] Moodle error fetching assignments: {data}")
        return []

    results = []
    for course in data.get("courses", []):
        course_id = course.get("id")
        for assignment in course.get("assignments", []):
            due_timestamp = assignment.get("duedate", 0)
            if due_timestamp:
                due_date = datetime.fromtimestamp(due_timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            else:
                due_date = None
            results.append({
                "course_id": course_id,
                "assignment_id": assignment.get("id"),
                "name": assignment.get("name"),
                "due_date": due_date,
                "max_grade": assignment.get("grade"),
            })

    print(f"[moodle_loader] Fetched {len(results)} assignment(s)")
    return results


def fetch_moodle_assignment_submissions():
    """
    Returns a flat list of per-student submission records across every
    assignment in every configured course:
    {
      "course_id": ..., "assignment_id": ..., "assignment_name": ...,
      "due_date": "YYYY-MM-DD", "student_id": ..., "status": "new"|"submitted"|...,
      "grading_status": "notgraded"|"graded"|..., "grade": "85.00" or None,
      "submitted_at": "YYYY-MM-DD HH:MM" or None,
    }
    Combines mod_assign_get_assignments (for names/due dates), the
    submissions themselves (mod_assign_get_submissions), and grades
    (mod_assign_get_grades) in one pass so the frontend gets one ready-to-
    display table instead of three separate calls.
    """
    if not MOODLE_TOKEN or not MOODLE_COURSE_IDS:
        print("[moodle_loader] Missing token or course IDs - skipping submissions.")
        return []

    assignments = fetch_moodle_assignments()
    assignment_ids = [a["assignment_id"] for a in assignments if a.get("assignment_id")]
    if not assignment_ids:
        return []

    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"

    # --- submissions (status: new/submitted/draft, gradingstatus) ---
    params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "mod_assign_get_submissions",
        "moodlewsrestformat": "json",
    }
    for i, aid in enumerate(assignment_ids):
        params[f"assignmentids[{i}]"] = aid

    try:
        response = requests.post(endpoint, data=params, timeout=10)
        submissions_data = response.json()
    except Exception as e:
        print(f"[moodle_loader] Could not fetch submissions: {e}")
        return []

    if isinstance(submissions_data, dict) and "exception" in submissions_data:
        print(f"[moodle_loader] Moodle error fetching submissions: {submissions_data}")
        return []

    # --- grades (numeric grade per student, once graded) ---
    grade_params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "mod_assign_get_grades",
        "moodlewsrestformat": "json",
    }
    for i, aid in enumerate(assignment_ids):
        grade_params[f"assignmentids[{i}]"] = aid

    try:
        response = requests.post(endpoint, data=grade_params, timeout=10)
        grades_data = response.json()
    except Exception as e:
        print(f"[moodle_loader] Could not fetch grades: {e}")
        grades_data = {"assignments": []}

    # grade lookup: (assignment_id, userid) -> grade string
    grade_lookup = {}
    for a in grades_data.get("assignments", []):
        aid = a.get("assignmentid")
        for g in a.get("grades", []):
            grade_lookup[(aid, g.get("userid"))] = g.get("grade")

    # assignment metadata lookup for name/due_date/course_id
    meta_lookup = {a["assignment_id"]: a for a in assignments if a.get("assignment_id")}

    results = []
    for a in submissions_data.get("assignments", []):
        aid = a.get("assignmentid")
        meta = meta_lookup.get(aid, {})
        for s in a.get("submissions", []):
            submitted_timestamp = s.get("timemodified", 0)
            submitted_at = (
                datetime.fromtimestamp(submitted_timestamp, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
                if submitted_timestamp else None
            )
            results.append({
                "course_id": meta.get("course_id"),
                "assignment_id": aid,
                "assignment_name": meta.get("name"),
                "due_date": meta.get("due_date"),
                "student_id": s.get("userid"),
                "status": s.get("status"),
                "grading_status": s.get("gradingstatus"),
                "grade": grade_lookup.get((aid, s.get("userid"))),
                "submitted_at": submitted_at,
            })

    print(f"[moodle_loader] Fetched {len(results)} submission record(s) across {len(assignment_ids)} assignment(s)")
    return results


def fetch_moodle_enrolled_students():
    """
    Returns a list of enrolled student dicts across all configured courses:
    { "course_id": ..., "student_id": ..., "name": ..., "email": ... }
    using core_enrol_get_enrolled_users (one course per call).
    Skips auto-created system accounts (e.g. MoodleCloud Support).
    """
    if not MOODLE_TOKEN or not MOODLE_COURSE_IDS:
        print("[moodle_loader] Missing token or course IDs - skipping enrolled students.")
        return []

    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    all_results = []

    for course_id in MOODLE_COURSE_IDS:
        params = {
            "wstoken": MOODLE_TOKEN,
            "wsfunction": "core_enrol_get_enrolled_users",
            "moodlewsrestformat": "json",
            "courseid": course_id,
        }

        try:
            response = requests.post(endpoint, data=params, timeout=10)
            data = response.json()
        except Exception as e:
            print(f"[moodle_loader] Could not fetch enrolled users for course {course_id}: {e}")
            continue

        if isinstance(data, dict) and "exception" in data:
            print(f"[moodle_loader] Moodle error for course {course_id}: {data}")
            continue

        for user in data:
            email = user.get("email", "")
            if email in IGNORED_EMAILS:
                continue
            all_results.append({
                "course_id": course_id,
                "student_id": user.get("id"),
                "name": user.get("fullname"),
                "email": email,
            })

    print(f"[moodle_loader] Fetched {len(all_results)} enrollment(s) across {len(MOODLE_COURSE_IDS)} course(s)")
    return all_results


def _get_attendance_instance_id(course_id):
    """
    Find the attendance activity's instance ID within a course.
    Attendance sessions are looked up by this instance ID, not the course ID,
    so we first read the course contents (same function Pages uses) and find
    the module with modname == "attendance".
    """
    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "core_course_get_contents",
        "moodlewsrestformat": "json",
        "courseid": course_id,
    }
    try:
        response = requests.post(endpoint, data=params, timeout=10)
        data = response.json()
    except Exception as e:
        print(f"[moodle_loader] Could not look up attendance activity for course {course_id}: {e}")
        return None

    if isinstance(data, dict):
        return None

    for section in data:
        for module in section.get("modules", []):
            if module.get("modname") == "attendance":
                return module.get("instance")
    return None


def fetch_moodle_attendance_sessions():
    """
    Returns a list of attendance session dicts across all configured courses:
    { "course_id": ..., "session_id": ..., "date": "YYYY-MM-DD", "description": ... }
    using mod_attendance_get_sessions.
    """
    if not MOODLE_TOKEN or not MOODLE_COURSE_IDS:
        print("[moodle_loader] Missing token or course IDs - skipping attendance.")
        return []

    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    all_results = []

    for course_id in MOODLE_COURSE_IDS:
        attendance_id = _get_attendance_instance_id(course_id)
        if not attendance_id:
            print(f"[moodle_loader] No attendance activity found for course {course_id}")
            continue

        params = {
            "wstoken": MOODLE_TOKEN,
            "wsfunction": "mod_attendance_get_sessions",
            "moodlewsrestformat": "json",
            "attendanceid": attendance_id,
        }

        try:
            response = requests.post(endpoint, data=params, timeout=10)
            data = response.json()
        except Exception as e:
            print(f"[moodle_loader] Could not fetch attendance sessions for course {course_id}: {e}")
            continue

        if isinstance(data, dict) and "exception" in data:
            print(f"[moodle_loader] Moodle error for course {course_id} attendance: {data}")
            continue

        sessions = data if isinstance(data, list) else data.get("sessions", [])
        for session in sessions:
            sess_timestamp = session.get("sessdate", 0)
            if sess_timestamp:
                date = datetime.fromtimestamp(sess_timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            else:
                date = None
            all_results.append({
                "course_id": course_id,
                "session_id": session.get("id"),
                "date": date,
                "description": session.get("description", ""),
            })

    print(f"[moodle_loader] Fetched {len(all_results)} attendance session(s) across {len(MOODLE_COURSE_IDS)} course(s)")
    return all_results


def fetch_moodle_attendance_records():
    """
    Returns a flat list of REAL per-student attendance marks (not just
    session metadata) across every session in every configured course:
    {
      "course_id": ..., "session_id": ..., "date": "YYYY-MM-DD",
      "description": ..., "student_id": ..., "student_name": ...,
      "student_email": ..., "status": "Present"|"Late"|"Excused"|"Absent",
      "status_acronym": "P"|"L"|"E"|"A",
    }
    Uses mod_attendance_get_session (singular) per session, which returns
    the full roster taken for that session (attendance_log) plus the
    status definitions (statuses) - this is the same data Moodle's own
    "take attendance" screen uses, so it reflects real marks rather than
    just a list of session dates.

    This makes one Moodle call per session, so it is noticeably slower
    than the other fetchers - call it on demand, not on every page load.
    """
    if not MOODLE_TOKEN or not MOODLE_COURSE_IDS:
        print("[moodle_loader] Missing token or course IDs - skipping attendance records.")
        return []

    sessions = fetch_moodle_attendance_sessions()
    if not sessions:
        return []

    # Build a student_id -> {name, email} lookup once, reused for every session
    students_by_id = {
        s["student_id"]: s for s in fetch_moodle_enrolled_students()
    }

    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    all_results = []

    for session in sessions:
        params = {
            "wstoken": MOODLE_TOKEN,
            "wsfunction": "mod_attendance_get_session",
            "moodlewsrestformat": "json",
            "sessionid": session["session_id"],
        }
        try:
            response = requests.post(endpoint, data=params, timeout=10)
            data = response.json()
        except Exception as e:
            print(f"[moodle_loader] Could not fetch session {session['session_id']}: {e}")
            continue

        if isinstance(data, dict) and "exception" in data:
            print(f"[moodle_loader] Moodle error for session {session['session_id']}: {data}")
            continue

        status_lookup = {
            st["id"]: {"description": st["description"], "acronym": st["acronym"]}
            for st in data.get("statuses", [])
        }

        for log_entry in data.get("attendance_log", []):
            student_id = log_entry.get("studentid")
            status_id = int(log_entry.get("statusid"))
            status_info = status_lookup.get(status_id, {"description": "Unknown", "acronym": "?"})
            student_info = students_by_id.get(student_id, {})

            all_results.append({
                "course_id": session["course_id"],
                "session_id": session["session_id"],
                "date": session["date"],
                "description": session["description"],
                "student_id": student_id,
                "student_name": student_info.get("name", f"User #{student_id}"),
                "student_email": student_info.get("email", ""),
                "status": status_info["description"],
                "status_acronym": status_info["acronym"],
            })

    print(f"[moodle_loader] Fetched {len(all_results)} attendance record(s) across {len(sessions)} session(s)")
    return all_results
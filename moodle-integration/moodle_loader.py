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
        response = requests.get(endpoint, params=params, timeout=10)
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
    { "course_id": ..., "name": ..., "due_date": "YYYY-MM-DD", "max_grade": ... }
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
        response = requests.get(endpoint, params=params, timeout=10)
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
                "name": assignment.get("name"),
                "due_date": due_date,
                "max_grade": assignment.get("grade"),
            })

    print(f"[moodle_loader] Fetched {len(results)} assignment(s)")
    return results


def fetch_moodle_enrolled_students():
    """
    Returns a list of enrolled student dicts across all configured courses:
    { "course_id": ..., "student_id": ..., "name": ..., "email": ... }
    using core_enrol_get_enrolled_users (one course per call).
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
            response = requests.get(endpoint, params=params, timeout=10)
            data = response.json()
        except Exception as e:
            print(f"[moodle_loader] Could not fetch enrolled users for course {course_id}: {e}")
            continue

        if isinstance(data, dict) and "exception" in data:
            print(f"[moodle_loader] Moodle error for course {course_id}: {data}")
            continue

        for user in data:
            all_results.append({
                "course_id": course_id,
                "student_id": user.get("id"),
                "name": user.get("fullname"),
                "email": user.get("email"),
            })

    print(f"[moodle_loader] Fetched {len(all_results)} enrollment(s) across {len(MOODLE_COURSE_IDS)} course(s)")
    return all_results
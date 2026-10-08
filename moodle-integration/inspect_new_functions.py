"""
One-off inspection script: calls the 4 newly-enabled functions with real
IDs pulled from your existing data, and prints the RAW JSON response for
each. This is so we can see the actual field names/shapes Moodle 5.2.2
returns before writing real parsing code against them - no guessing.

Usage (from moodle-integration/, with venv active):
    python inspect_new_functions.py
"""
import os
import json
import requests
from dotenv import load_dotenv

from moodle_loader import (
    MOODLE_COURSE_IDS,
    fetch_moodle_assignments,
    fetch_moodle_attendance_sessions,
)

load_dotenv()

MOODLE_URL = os.getenv("MOODLE_URL")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN")
ENDPOINT = f"{MOODLE_URL}/webservice/rest/server.php"


def call(wsfunction, **params):
    params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": wsfunction,
        "moodlewsrestformat": "json",
        **params,
    }
    response = requests.get(ENDPOINT, params=params, timeout=10)
    return response.json()


def pretty(label, data):
    print(f"\n{'=' * 10} {label} {'=' * 10}")
    print(json.dumps(data, indent=2)[:3000])  # cap output so it stays readable


print("Pulling a real session ID via fetch_moodle_attendance_sessions()...")
sessions = fetch_moodle_attendance_sessions()
if sessions:
    sample_session = sessions[0]
    print(f"Using session: {sample_session}")
    result = call("mod_attendance_get_session", sessionid=sample_session["session_id"])
    pretty("mod_attendance_get_session", result)
else:
    print("No attendance sessions found - skipping mod_attendance_get_session.")

print("\nPulling a real assignment ID directly (fetch_moodle_assignments doesn't expose id)...")
raw = call(
    "mod_assign_get_assignments",
    **{f"courseids[{i}]": cid for i, cid in enumerate(MOODLE_COURSE_IDS)},
)
sample_assignment = None
for course in raw.get("courses", []):
    for a in course.get("assignments", []):
        sample_assignment = a
        break
    if sample_assignment:
        break

if sample_assignment:
    assignment_id = sample_assignment["id"]
    print(f"Using assignment: id={assignment_id}, name={sample_assignment.get('name')}")

    result = call("mod_assign_get_submissions", **{"assignmentids[0]": assignment_id})
    pretty("mod_assign_get_submissions", result)

    # submission_status needs a userid - grab the first enrolled student we can find
    from moodle_loader import fetch_moodle_enrolled_students
    students = fetch_moodle_enrolled_students()
    if students:
        sample_user_id = students[0]["student_id"]
        print(f"Using userid: {sample_user_id} ({students[0]['name']})")
        result = call("mod_assign_get_submission_status", assignid=assignment_id, userid=sample_user_id)
        pretty("mod_assign_get_submission_status", result)
    else:
        print("No enrolled students found - skipping mod_assign_get_submission_status.")

    result = call("mod_assign_get_grades", **{"assignmentids[0]": assignment_id})
    pretty("mod_assign_get_grades", result)
else:
    print("No assignments found - skipping submission/grade calls.")

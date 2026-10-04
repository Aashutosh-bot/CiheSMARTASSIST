"""
One-off discovery script: lists every Moodle web service function
enabled for the token in .env, plus basic site info. Run this once
to see exactly what's available before we build new features on it.

Usage (from moodle-integration/, with venv active):
    python discover_functions.py
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

MOODLE_URL = os.getenv("MOODLE_URL")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN")

endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
params = {
    "wstoken": MOODLE_TOKEN,
    "wsfunction": "core_webservice_get_site_info",
    "moodlewsrestformat": "json",
}

response = requests.get(endpoint, params=params, timeout=10)
data = response.json()

if "exception" in data:
    print("Error calling Moodle:", data)
else:
    print(f"Site: {data.get('sitename')}")
    print(f"Moodle release: {data.get('release')}")
    print(f"User: {data.get('fullname')} (userid {data.get('userid')})")
    print()
    functions = data.get("functions", [])
    print(f"Enabled functions ({len(functions)}):")
    attendance_related = []
    assign_related = []
    other = []
    for f in sorted(functions, key=lambda x: x["name"]):
        name = f["name"]
        if "attendance" in name:
            attendance_related.append(name)
        elif "assign" in name:
            assign_related.append(name)
        else:
            other.append(name)

    print("\n--- Attendance-related ---")
    for n in attendance_related:
        print(" ", n)
    print("\n--- Assignment-related ---")
    for n in assign_related:
        print(" ", n)
    print("\n--- Everything else ---")
    for n in other:
        print(" ", n)

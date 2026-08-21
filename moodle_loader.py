import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and makes its values available

MOODLE_URL = os.getenv("MOODLE_URL")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN")
MOODLE_COURSE_ID = os.getenv("MOODLE_COURSE_ID")


def fetch_moodle_pages():
    """
    Connects to Moodle, finds every 'Page' module in the configured course,
    and returns a list of (source_name, clean_text) tuples ready for chunking.
    Returns an empty list if Moodle is unreachable, so the rest of the app
    keeps working even if the Moodle sandbox is down or reset.
    """
    if not MOODLE_TOKEN:
        print("[moodle_loader] No MOODLE_TOKEN set in .env — skipping Moodle content.")
        return []

    endpoint = f"{MOODLE_URL}/webservice/rest/server.php"
    params = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "core_course_get_contents",
        "moodlewsrestformat": "json",
        "courseid": MOODLE_COURSE_ID,
    }

    try:
        response = requests.get(endpoint, params=params, timeout=10)
        data = response.json()
    except Exception as e:
        print(f"[moodle_loader] Could not reach Moodle: {e}")
        return []

    # Moodle error responses come back as a dict with an "exception" or
    # "errorcode" key (NOT always "error") — check broadly and print it
    # so we can see exactly what went wrong instead of crashing later.
    if isinstance(data, dict):
        print(f"[moodle_loader] Moodle returned an error response: {data}")
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
                source_name = f"moodle::{module.get('name')}"
                results.append((source_name, clean_text))

    print(f"[moodle_loader] Fetched {len(results)} page(s) from Moodle")
    return results
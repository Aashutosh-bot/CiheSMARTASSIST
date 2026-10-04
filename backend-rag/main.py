import os
import sys
from collections import Counter
from datetime import datetime
from typing import Optional
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_engine import build_index, search
from generator import generate_answer

# The Node/Express backend (backend-data) holds SmartAssist's own student
# records, unit enrollments and class timetable - separate from Moodle.
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000")
WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# moodle_loader.py lives in a sibling folder (../moodle-integration), not here.
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "moodle-integration"))
from moodle_loader import (
    fetch_moodle_assignments,
    fetch_moodle_assignment_submissions,
    fetch_moodle_enrolled_students,
    fetch_moodle_attendance_sessions,
    fetch_moodle_attendance_records,
)

app = FastAPI()

# Allow Roshan's React dev server (port 3000) to call this API.
# Without this, the browser blocks the request even if the server responds fine -
# this is a browser security feature called CORS, not a bug in either of our code.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str


class ChatRequest(BaseModel):
    message: str
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


VALID_EMAIL = "student@cihe.edu.au"
VALID_PASSWORD = "password123"

# Below this similarity score, we treat the match as "not actually relevant"
# and escalate instead of letting the AI generate an answer from a weak match.
RELEVANCE_THRESHOLD = 0.35

print("Building retrieval index at startup...")
index, chunks, sources = build_index()
print("Index ready.")

# In-memory log of questions asked this session (resets on server restart).
# A real database would replace this in a later iteration.
query_log = []


def topic_from_source(source):
    """
    Turns a raw source identifier into a human-readable topic for the admin
    "most asked questions by field" analytics. Moodle sources look like
    "moodle::course14::Fees and Payment" - we use the last segment. Local
    document sources look like "fees_and_payment.txt" - we strip the
    extension and title-case the underscores.
    """
    if not source:
        return "Unmatched"
    if "::" in source:
        return source.split("::")[-1]
    name = source.rsplit(".", 1)[0]
    return name.replace("_", " ").title()


# --- Personalized, live-data answers ------------------------------------
# These bypass the document-retrieval RAG pipeline entirely: the student is
# asking about THEIR OWN record (attendance, deadlines, schedule), which no
# static document could ever contain. We detect that intent, pull the real
# number straight from Moodle (or SmartAssist's own backend for timetable),
# and answer directly.

def detect_personal_intent(message):
    """Very small keyword-based intent router. Requires 'my' so general
    policy questions ('what's the attendance policy?') still fall through
    to the normal document search instead of being hijacked here."""
    msg = message.lower()
    if "my" not in msg:
        return None
    if "attendance" in msg and "policy" not in msg:
        return "attendance"
    if ("deadline" in msg or "due" in msg or "assignment" in msg) and "policy" not in msg:
        return "deadline"
    if "class" in msg or "room" in msg or "schedule" in msg or "timetable" in msg:
        return "next_class"
    return None


def answer_attendance(email):
    records = [r for r in fetch_moodle_attendance_records() if r["student_email"] == email]
    if not records:
        return ("I don't see any Moodle attendance marked for you yet. Either no sessions have been taken "
                "for your course yet, or your lecturer hasn't marked the roll for a session you attended. "
                "Check with them if you think this is wrong.")
    total = len(records)
    present = len([r for r in records if r["status"] == "Present"])
    rate = round((present / total) * 100)
    return f"Your attendance is {rate}% ({present} of {total} sessions marked Present), based on live Moodle attendance records."


def answer_deadline(email):
    student = next((s for s in fetch_moodle_enrolled_students() if s["email"] == email), None)
    if not student:
        return ("I couldn't find your Moodle enrolment with this email, so I can't look up your assignments. "
                "Make sure you're logged in with the email your course is actually enrolled under in Moodle.")
    submissions = [s for s in fetch_moodle_assignment_submissions() if s["student_id"] == student["student_id"]]
    if not submissions:
        return "I don't see any assignments set up for your enrolled course(s) in Moodle yet."

    today = datetime.now().strftime("%Y-%m-%d")
    upcoming = sorted(
        [s for s in submissions if s.get("due_date") and s["due_date"] >= today],
        key=lambda s: s["due_date"]
    )
    if not upcoming:
        return "You don't have any upcoming assignment deadlines — all the ones I can see are already past their due date."

    next_due = upcoming[0]
    status_phrase = "already submitted" if next_due.get("status") == "submitted" else "not submitted yet"
    return (f"Your next assignment deadline is \"{next_due['assignment_name']}\", due {next_due['due_date']}. "
            f"Status: {status_phrase}.")


def answer_next_class(email):
    try:
        students = requests.get(f"{NODE_BACKEND_URL}/api/students", timeout=5).json()
    except Exception:
        return "I couldn't reach the SmartAssist student records service to look up your timetable. Make sure the backend-data server is running."

    student = next((s for s in students if s.get("email") == email), None)
    if not student or not student.get("unitCodes"):
        return "You don't have any units assigned on your SmartAssist profile yet, so I can't find your class schedule — ask your admin to assign your units."

    try:
        sessions = requests.get(f"{NODE_BACKEND_URL}/api/timetable", timeout=5).json()
    except Exception:
        return "I couldn't reach the timetable service right now — try again in a moment."

    my_sessions = [s for s in sessions if s.get("unitCode") in student["unitCodes"]]
    if not my_sessions:
        return "Your enrolled units don't have any class sessions scheduled yet — ask your admin to add them."

    now = datetime.now()
    today_idx = now.weekday()  # Monday=0
    current_time = now.strftime("%H:%M")

    def sort_key(s):
        try:
            day_idx = WEEKDAY_ORDER.index(s.get("dayOfWeek"))
        except ValueError:
            day_idx = 0
        days_until = (day_idx - today_idx) % 7
        if days_until == 0 and (s.get("startTime") or "") <= current_time:
            days_until = 7  # already happened today, so it's next week
        return (days_until, s.get("startTime") or "")

    next_session = sorted(my_sessions, key=sort_key)[0]
    where = next_session.get("room") or next_session.get("location") or "room TBA"
    teacher = f" with {next_session['teacher']}" if next_session.get("teacher") else ""
    return (f"Your next class is {next_session.get('unitCode')} ({next_session.get('mode', 'Class')}) on "
            f"{next_session.get('dayOfWeek')} {next_session.get('startTime', '')}–{next_session.get('endTime', '')} "
            f"in {where}{teacher}.")


PERSONAL_INTENT_HANDLERS = {
    "attendance": ("Attendance", answer_attendance),
    "deadline": ("Assignments", answer_deadline),
    "next_class": ("Class Schedule", answer_next_class),
}


@app.get("/")
def read_root():
    return {"message": "Hello from CIHE SmartAssist!"}


@app.post("/api/login")
def login(request: LoginRequest):
    if request.email == VALID_EMAIL and request.password == VALID_PASSWORD:
        return {"success": True}
    return {"success": False, "message": "Invalid email or password."}


@app.post("/api/query")
def ask_question(request: QuestionRequest):
    """Original endpoint - kept for your own testing via /docs."""
    results = search(index, chunks, sources, request.question, top_k=1)
    if not results:
        return {"answer": "I couldn't find anything relevant to that question.", "confidence": 0.0, "source": None}
    best_match = results[0]
    answer = generate_answer(request.question, best_match["text"])
    return {"answer": answer, "confidence": round(best_match["score"], 3), "source": best_match["source"]}


@app.post("/api/chat")
def chat(request: ChatRequest):
    """Matches Roshan's frontend contract: { message } -> { text, sources }."""

    # Personal questions ("what's MY attendance", "when's MY next class") can
    # never be answered from static documents - handle those with real data
    # for the logged-in student before falling through to document search.
    intent = detect_personal_intent(request.message)
    if intent:
        topic, handler = PERSONAL_INTENT_HANDLERS[intent]
        if not request.email:
            answer_text = "I'd need you to be logged in to look that up for you personally - please log in and ask again."
        else:
            answer_text = handler(request.email)
        query_log.insert(0, {"question": request.message, "status": "Answered", "topic": topic})
        return {"text": answer_text, "sources": [f"Live {topic} Data"]}

    results = search(index, chunks, sources, request.message, top_k=1)

    # If nothing relevant enough was found, don't let the AI guess/hallucinate
    if not results or results[0]["score"] < RELEVANCE_THRESHOLD:
        query_log.insert(0, {"question": request.message, "status": "Escalated", "topic": "Unmatched"})
        return {
            "text": "I'm not sure - try Student Services.",
            "sources": ["Student Handbook"],
            "unmatched": True,
        }

    best_match = results[0]
    answer_text = generate_answer(request.message, best_match["text"])

    query_log.insert(0, {
        "question": request.message,
        "status": "Answered",
        "topic": topic_from_source(best_match["source"]),
    })

    return {
        "text": answer_text,
        "sources": [best_match["source"]],
    }


@app.get("/api/dashboard")
def dashboard():
    total = len(query_log)
    answered = len([q for q in query_log if q["status"] == "Answered"])
    satisfaction = round((answered / total) * 100) if total > 0 else 100

    return {
        "totalQueries": total,
        "avgResponseTime": "1.2s",
        "satisfactionRate": satisfaction,
        "documentsIndexed": len(set(sources)),
        "recentQueries": query_log[:5],
    }


@app.get("/api/chat-insights")
def chat_insights():
    """
    Admin-facing chatbot analytics: how many questions are coming in, how
    many get answered vs escalated, which exact questions are asked most
    often, and which topics/fields (derived from the matched source
    document) students ask about most. Powers the admin "Chatbot Insights"
    tab so staff can see what students actually need help with.
    """
    total = len(query_log)
    answered = len([q for q in query_log if q["status"] == "Answered"])
    escalated = total - answered

    question_counts = Counter(q["question"].strip().lower() for q in query_log if q["question"].strip())
    topic_counts = Counter(q.get("topic") or "Unmatched" for q in query_log)

    top_questions = [{"question": q, "count": c} for q, c in question_counts.most_common(10)]
    top_topics = [{"topic": t, "count": c} for t, c in topic_counts.most_common(10)]

    return {
        "totalQueries": total,
        "answered": answered,
        "escalated": escalated,
        "topQuestions": top_questions,
        "topTopics": top_topics,
    }


@app.get("/api/moodle/assignments")
def moodle_assignments():
    """Live assignment due dates pulled directly from Moodle."""
    return fetch_moodle_assignments()


@app.get("/api/moodle/students")
def moodle_students():
    """Live enrolled-student list pulled directly from Moodle, per course."""
    return fetch_moodle_enrolled_students()


@app.get("/api/moodle/attendance")
def moodle_attendance():
    """Live attendance session dates pulled directly from Moodle, per course."""
    return fetch_moodle_attendance_sessions()


@app.get("/api/moodle/attendance-records")
def moodle_attendance_records():
    """
    Real per-student attendance marks (Present/Late/Excused/Absent) pulled
    from Moodle's attendance roster for every session. Slower than the
    other endpoints (one Moodle call per session), so call this only when
    the detailed view is actually opened, not on every page load.
    """
    return fetch_moodle_attendance_records()


@app.get("/api/moodle/submissions")
def moodle_submissions():
    """
    Real per-student assignment submission status, grading status, and
    grade (once graded) pulled directly from Moodle.
    """
    return fetch_moodle_assignment_submissions()


@app.get("/api/moodle/attendance-records/student")
def moodle_attendance_records_for_student(email: str):
    """
    This student's own attendance records, filtered by email - used by the
    student-facing "My Moodle" view so a student only sees their own marks.
    """
    records = fetch_moodle_attendance_records()
    return [r for r in records if r["student_email"] == email]


@app.get("/api/moodle/submissions/student")
def moodle_submissions_for_student(email: str):
    """
    This student's own assignment submission status - used by the
    student-facing "My Moodle" view.
    """
    student = next((s for s in fetch_moodle_enrolled_students() if s["email"] == email), None)
    if not student:
        return []
    submissions = fetch_moodle_assignment_submissions()
    return [s for s in submissions if s["student_id"] == student["student_id"]]
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_engine import build_index, search
from generator import generate_answer

# moodle_loader.py lives in a sibling folder (../moodle-integration), not here.
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "moodle-integration"))
from moodle_loader import (
    fetch_moodle_assignments,
    fetch_moodle_enrolled_students,
    fetch_moodle_attendance_sessions,
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
    results = search(index, chunks, sources, request.message, top_k=1)

    # If nothing relevant enough was found, don't let the AI guess/hallucinate
    if not results or results[0]["score"] < RELEVANCE_THRESHOLD:
        query_log.insert(0, {"question": request.message, "status": "Escalated"})
        return {
            "text": "I'm not sure - try Student Services.",
            "sources": ["Student Handbook"],
            "unmatched": True,
        }

    best_match = results[0]
    answer_text = generate_answer(request.message, best_match["text"])

    query_log.insert(0, {"question": request.message, "status": "Answered"})

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
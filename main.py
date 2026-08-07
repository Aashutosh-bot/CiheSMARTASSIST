from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class QuestionRequest(BaseModel):
    question: str


@app.get("/")
def read_root():
    return {"message": "Hello from CIHE SmartAssist!"}


@app.post("/api/query")
def ask_question(request: QuestionRequest):
    return {
        "answer": f"You asked: '{request.question}' — but I don't know how to think yet!",
        "confidence": 0.0
    }
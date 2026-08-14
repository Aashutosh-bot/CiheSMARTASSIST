from fastapi import FastAPI
from pydantic import BaseModel
from rag_engine import build_index, search
from generator import generate_answer

app = FastAPI()


class QuestionRequest(BaseModel):
    question: str


print("Building retrieval index at startup...")
index, chunks, sources = build_index()
print("Index ready.")


@app.get("/")
def read_root():
    return {"message": "Hello from CIHE SmartAssist!"}


@app.post("/api/query")
def ask_question(request: QuestionRequest):
    results = search(index, chunks, sources, request.question, top_k=1)

    if not results:
        return {
            "answer": "I couldn't find anything relevant to that question.",
            "confidence": 0.0,
            "source": None,
        }

    best_match = results[0]
    answer = generate_answer(request.question, best_match["text"])

    return {
        "answer": answer,
        "confidence": round(best_match["score"], 3),
        "source": best_match["source"],
    }
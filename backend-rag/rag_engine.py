import os
import sys
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# moodle_loader.py lives in a sibling folder (../moodle-integration), not here.
# This line adds that folder to Python's search path so the import below works
# no matter which directory you run this script from.
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "moodle-integration"))
from moodle_loader import fetch_moodle_pages

DOCS_FOLDER = "documents"
CHUNK_SIZE = 100
OVERLAP = 20

model = SentenceTransformer("all-MiniLM-L6-v2")


def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=OVERLAP):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap
    return chunks


def load_and_chunk_all_documents():
    """Read every .txt file in documents/, split into chunks, and remember which file each came from."""
    all_chunks = []
    all_sources = []

    for filename in os.listdir(DOCS_FOLDER):
        if not filename.endswith(".txt"):
            continue
        filepath = os.path.join(DOCS_FOLDER, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
        chunks = chunk_text(text)
        for chunk in chunks:
            all_chunks.append(chunk)
            all_sources.append(filename)

    return all_chunks, all_sources


def load_and_chunk_moodle_content():
    """
    Pull live content from Moodle (via moodle_loader) and chunk it the same
    way local documents are chunked, so it can be merged into the same index.
    If Moodle is unreachable or not configured, fetch_moodle_pages() returns
    an empty list, so this simply contributes nothing — no crash.
    """
    all_chunks = []
    all_sources = []

    moodle_pages = fetch_moodle_pages()  # list of (source_name, text) tuples

    for source_name, text in moodle_pages:
        chunks = chunk_text(text)
        for chunk in chunks:
            all_chunks.append(chunk)
            all_sources.append(source_name)

    return all_chunks, all_sources


def build_index():
    """
    Build a FAISS index from BOTH local documents and live Moodle content.
    Returns the index plus the chunks/sources for lookup later.
    """
    local_chunks, local_sources = load_and_chunk_all_documents()
    moodle_chunks, moodle_sources = load_and_chunk_moodle_content()

    chunks = local_chunks + moodle_chunks
    sources = local_sources + moodle_sources

    embeddings = model.encode(chunks, normalize_embeddings=True)
    embeddings = np.array(embeddings, dtype="float32")

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    print(
        f"Built index with {len(chunks)} chunks "
        f"({len(local_chunks)} from local documents, {len(moodle_chunks)} from Moodle)"
    )
    return index, chunks, sources


def search(index, chunks, sources, query, top_k=3):
    """Given a question, return the top_k most relevant chunks."""
    query_vector = model.encode([query], normalize_embeddings=True)
    query_vector = np.array(query_vector, dtype="float32")

    scores, indices = index.search(query_vector, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        results.append({
            "text": chunks[idx],
            "source": sources[idx],
            "score": float(score),
        })
    return results
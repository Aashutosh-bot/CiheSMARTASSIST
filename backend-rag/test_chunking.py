def chunk_text(text, chunk_size=40, overlap=10):
    """Split text into overlapping chunks of `chunk_size` words."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == len(words):
            break
        start = end - overlap
    return chunks


# Load the document
with open("documents/enrollment_faq.txt", "r", encoding="utf-8") as f:
    text = f.read()

chunks = chunk_text(text)

print(f"Document split into {len(chunks)} chunks:\n")
for i, chunk in enumerate(chunks):
    print(f"--- Chunk {i} ---")
    print(chunk)
    print()
from sentence_transformers import SentenceTransformer, util

print("Loading embedding model (first time will download it, ~80MB)...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Model loaded!\n")

# Turn a few sentences into vectors
sentences = [
    "How do I pay my tuition fees?",
    "What are the payment options for course costs?",
    "What time does the library open?",
]

embeddings = model.encode(sentences)

print(f"Each sentence became a vector of length: {len(embeddings[0])}")
print(f"\nFirst 5 numbers of sentence 1's vector: {embeddings[0][:5]}")

# Compare sentence 0 (fees question) against the other two
print("\n--- Similarity scores (higher = more similar meaning) ---")
for i in range(1, len(sentences)):
    score = util.cos_sim(embeddings[0], embeddings[i])
    print(f"'{sentences[0]}'  vs  '{sentences[i]}'")
    print(f"  → similarity: {score.item():.3f}\n")
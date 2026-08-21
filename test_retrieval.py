from rag_engine import build_index, search

index, chunks, sources = build_index()

question = "How do I pay my tuition fees?"
results = search(index, chunks, sources, question)

print(f"\nQuestion: {question}\n")
for r in results:
    print(f"[{r['source']}] score={r['score']:.3f}")
    print(r["text"])
    print()
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

print("Loading generation model...")
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
print("Generation model ready.")


def generate_answer(question, context):
    """Given a question and a retrieved context chunk, generate a natural-language answer."""
    prompt = (
        f"You are a helpful assistant. Using ONLY the information in the context, "
        f"write a complete, natural sentence that answers the question.\n\n"
        f"Context: {context}\n\n"
        f"Question: {question}\n\n"
        f"Write a full sentence answer:"
    )

    inputs = tokenizer(prompt, return_tensors="pt")
    output_tokens = model.generate(**inputs, max_new_tokens=80)
    answer = tokenizer.decode(output_tokens[0], skip_special_tokens=True)

    return answer
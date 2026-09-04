from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

print("Loading generation model (first time downloads ~1GB, may take a few minutes)...")
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
print("Model loaded!\n")

context = (
    "Tuition fees are payable by the census date each semester. Fees can be paid "
    "via the Student Portal using credit card, bank transfer, or through an "
    "approved payment plan."
)
question = "How do I pay my tuition fees?"

prompt = (
    f"You are a helpful assistant. Using ONLY the information in the context, "
    f"write a complete, natural sentence that answers the question.\n\n"
    f"Context: {context}\n\n"
    f"Question: {question}\n\n"
    f"Write a full sentence answer:"
)

inputs = tokenizer(prompt, return_tensors="pt")
output_tokens = model.generate(**inputs, max_new_tokens=60)
answer = tokenizer.decode(output_tokens[0], skip_special_tokens=True)

print("Generated answer:")
print(answer)
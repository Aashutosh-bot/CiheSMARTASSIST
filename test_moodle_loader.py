from moodle_loader import fetch_moodle_pages

pages = fetch_moodle_pages()
for source, text in pages:
    print(f"--- {source} ---")
    print(text)
    print()
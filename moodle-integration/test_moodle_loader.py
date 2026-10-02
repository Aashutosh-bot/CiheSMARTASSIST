from moodle_loader import fetch_moodle_pages, fetch_moodle_assignments

print("=== PAGES ===")
pages = fetch_moodle_pages()
for source, text in pages:
    print(f"\n--- {source} ---")
    print(text)

print("\n\n=== ASSIGNMENTS ===")
assignments = fetch_moodle_assignments()
for a in assignments:
    print(a)
from moodle_loader import fetch_moodle_pages, fetch_moodle_assignments, fetch_moodle_enrolled_students

print("=== PAGES ===")
pages = fetch_moodle_pages()
for source, text in pages:
    print(f"\n--- {source} ---")
    print(text)

print("\n\n=== ASSIGNMENTS ===")
assignments = fetch_moodle_assignments()
for a in assignments:
    print(a)

print("\n\n=== ENROLLED STUDENTS ===")
students = fetch_moodle_enrolled_students()
for s in students:
    print(s)
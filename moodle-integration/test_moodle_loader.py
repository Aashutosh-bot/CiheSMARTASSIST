from moodle_loader import (
    fetch_moodle_pages,
    fetch_moodle_assignments,
    fetch_moodle_assignment_submissions,
    fetch_moodle_enrolled_students,
    fetch_moodle_attendance_sessions,
    fetch_moodle_attendance_records,
)

print("=== PAGES ===")
pages = fetch_moodle_pages()
for source, text in pages:
    print(f"\n--- {source} ---")
    print(text)

print("\n\n=== ASSIGNMENTS ===")
assignments = fetch_moodle_assignments()
for a in assignments:
    print(a)

print("\n\n=== ASSIGNMENT SUBMISSIONS (per-student status/grade) ===")
submissions = fetch_moodle_assignment_submissions()
for s in submissions:
    print(s)

print("\n\n=== ENROLLED STUDENTS ===")
students = fetch_moodle_enrolled_students()
for s in students:
    print(s)

print("\n\n=== ATTENDANCE SESSIONS ===")
sessions = fetch_moodle_attendance_sessions()
for sess in sessions:
    print(sess)

print("\n\n=== ATTENDANCE RECORDS (real per-student marks - slower, one call per session) ===")
records = fetch_moodle_attendance_records()
for r in records:
    print(r)

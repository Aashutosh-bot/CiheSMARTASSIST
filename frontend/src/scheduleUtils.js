export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SEMESTERS = {
  "Semester 1, 2026": { start: "2026-02-16", end: "2026-06-12" },
  "Semester 2, 2026": { start: "2026-07-24", end: "2026-11-20" }
};
export const SEMESTER_OPTIONS = Object.keys(SEMESTERS);
export const DEFAULT_SEMESTER = "Semester 2, 2026";
export const TEACHING_WEEKS = 12;
export const ALL_UNITS = "ALL";

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDMY(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function mondayOf(dateStr) {
  const date = parseDate(dateStr);
  const dayIdx = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setDate(date.getDate() - dayIdx);
  return toDateStr(date);
}

export function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

export function weekdayIndex(dateStr) {
  return (parseDate(dateStr).getDay() + 6) % 7;
}

export function buildWeeks(startDateStr, endDateStr) {
  const weeks = [];
  let cursor = mondayOf(startDateStr);
  const end = endDateStr;
  while (cursor <= end) {
    const weekEnd = addDays(cursor, 6);
    weeks.push({ start: cursor, end: weekEnd });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function formatWeekRange(week) {
  return `${formatDMY(week.start)} - ${formatDMY(week.end)}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

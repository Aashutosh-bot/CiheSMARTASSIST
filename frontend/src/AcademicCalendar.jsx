import { useState } from "react";

const NAVY = "#0f2a52";
const GOLD = "#e8a020";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PERIODS = [
  { label: "Semester 1 (Mar–Jun)", color: NAVY, months: [2, 3, 4, 5] },
  { label: "Semester 2 (Jul–Oct)", color: "#1c6fd6", months: [6, 7, 8, 9] },
  { label: "Summer Break Classes (Nov–Feb)", color: GOLD, months: [10, 11, 0, 1] }
];

function periodForMonth(month) {
  return PERIODS.find(p => p.months.includes(month)) || PERIODS[0];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function buildMonthGrid(year, month) {
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = startWeekday; i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const next = new Date(cells[cells.length - 1].date);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
}

const navBtnStyle = {
  background: NAVY, color: "white", border: "none", borderRadius: 6,
  padding: "8px 16px", fontSize: 13, fontWeight: "bold", cursor: "pointer"
};

function AcademicCalendar({ assessments }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState(null);

  const assessmentsByDate = {};
  assessments.forEach(a => {
    if (!assessmentsByDate[a.dueDate]) assessmentsByDate[a.dueDate] = [];
    assessmentsByDate[a.dueDate].push(a);
  });

  const cells = buildMonthGrid(cursor.year, cursor.month);
  const period = periodForMonth(cursor.month);
  const todayKey = dateKey(today);
  const selectedAssessments = selectedKey ? (assessmentsByDate[selectedKey] || []) : [];

  function goPrevMonth() {
    setSelectedKey(null);
    setCursor(c => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  }

  function goNextMonth() {
    setSelectedKey(null);
    setCursor(c => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 16 }}>
        {PERIODS.map(p => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: "inline-block" }} />
            {p.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
          Assessment due
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #e0e0e0", overflow: "hidden" }}>
        {/* Month header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #e0e0e0" }}>
          <button onClick={goPrevMonth} style={navBtnStyle}>‹ Prev</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: "bold", color: NAVY }}>{MONTH_NAMES[cursor.month]} {cursor.year}</div>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "white", background: period.color, borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>
              {period.label}
            </span>
          </div>
          <button onClick={goNextMonth} style={navBtnStyle}>Next ›</button>
        </div>

        {/* Weekday header row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {WEEKDAY_HEADERS.map(wd => (
            <div key={wd} style={{ padding: "8px 4px", textAlign: "center", fontSize: 11.5, fontWeight: "bold", color: "#888", background: "#f5f6f8", borderBottom: "1px solid #e0e0e0" }}>
              {wd}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((cell, i) => {
            const key = dateKey(cell.date);
            const dayAssessments = assessmentsByDate[key] || [];
            const hasAssessment = dayAssessments.length > 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <div
                key={key}
                onClick={() => hasAssessment && setSelectedKey(isSelected ? null : key)}
                title={hasAssessment ? dayAssessments.map(a => a.title).join(", ") : undefined}
                style={{
                  minHeight: 66, padding: "6px 6px 8px",
                  borderBottom: "1px solid #f0f0f0",
                  borderRight: i % 7 !== 6 ? "1px solid #f0f0f0" : "none",
                  cursor: hasAssessment ? "pointer" : "default",
                  background: isSelected ? "#fff7e6" : "white",
                  opacity: cell.inMonth ? 1 : 0.4
                }}
              >
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%", fontSize: 12.5,
                  fontWeight: isToday ? "bold" : "normal",
                  color: isToday ? "white" : "#333",
                  background: isToday ? NAVY : "transparent"
                }}>
                  {cell.date.getDate()}
                </div>
                {hasAssessment && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
                    {dayAssessments.slice(0, 4).map(a => (
                      <span key={a.id} style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedKey && selectedAssessments.length > 0 && (
        <div style={{ marginTop: 16, background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #e0e0e0", padding: "16px 20px" }}>
          <div style={{ fontSize: 13.5, fontWeight: "bold", color: NAVY, marginBottom: 10 }}>
            Due {selectedKey}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedAssessments.map(a => (
              <div key={a.id} style={{ fontSize: 13, color: "#333", borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>
                <strong>{a.title}</strong> — {a.unitCode} ({a.weight}%)
                {a.description && <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>{a.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AcademicCalendar;

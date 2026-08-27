import { WEEKDAYS, SEMESTER_START, SEMESTER_END, buildWeeks, addDays, formatWeekRange, todayStr } from "./scheduleUtils";

const NAVY = "#0f2a52";

const statusColors = {
  Present: { bg: "#d4edda", color: "#155724" },
  Absent: { bg: "#f8d7da", color: "#721c24" },
  NC: { bg: "transparent", color: "#aaa" },
  "-": { bg: "transparent", color: "#bbb" }
};

function StatusBadge({ label }) {
  const style = statusColors[label] || statusColors["-"];
  return (
    <span style={{ padding: "3px 8px", borderRadius: 14, fontSize: 11, fontWeight: label === "Present" || label === "Absent" ? "bold" : "normal", background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

export default function WeeklyAttendanceTable({ unitCode, sessions, records }) {
  const today = todayStr();
  const unitSessions = (sessions || []).filter(s => s.unitCode === unitCode);
  const classWeekdays = new Set(unitSessions.map(s => s.dayOfWeek));
  const recordsByDate = {};
  (records || []).filter(r => r.unitCode === unitCode).forEach(r => { recordsByDate[r.date] = r.status; });

  const allWeeks = buildWeeks(SEMESTER_START, SEMESTER_END).filter(w => w.start <= today);

  let runningPresent = 0;
  let runningClassDays = 0;

  const rows = allWeeks.map(week => {
    let weekPresent = 0;
    let weekClassDays = 0;
    const dayCells = WEEKDAYS.map((wd, idx) => {
      const dateStr = addDays(week.start, idx);
      if (!classWeekdays.has(wd)) return { label: "NC", dateStr };
      if (dateStr > today) return { label: "-", dateStr };
      const status = recordsByDate[dateStr];
      if (!status) return { label: "-", dateStr };
      weekClassDays += 1;
      if (status === "Present") weekPresent += 1;
      return { label: status, dateStr };
    });
    runningClassDays += weekClassDays;
    runningPresent += weekPresent;
    const weeklyPct = weekClassDays > 0 ? Math.round((weekPresent / weekClassDays) * 100) : null;
    const runningPct = runningClassDays > 0 ? Math.round((runningPresent / runningClassDays) * 100) : null;
    return { week, dayCells, weeklyPct, runningPct };
  });

  const thStyle = { background: NAVY, color: "white", fontWeight: "bold", padding: "10px 12px", fontSize: 12, textAlign: "center", border: "1px solid #0a2140" };
  const tdStyle = (shaded) => ({ background: shaded ? "#f5f7fa" : "white", color: "#111", padding: "9px 12px", fontSize: 12.5, textAlign: "center", border: "1px solid #dde3ea" });

  if (unitSessions.length === 0) {
    return <div style={{ fontSize: 13, color: "#888" }}>No timetable has been set up for this unit yet, so attendance cannot be calculated.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }}>Week</th>
            {WEEKDAYS.map(wd => <th key={wd} style={thStyle}>{wd}</th>)}
            <th style={thStyle}>Weekly %</th>
            <th style={thStyle}>Running %</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={10} style={tdStyle(false)}>No weeks to display yet.</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.week.start}>
              <td style={{ ...tdStyle(i % 2 === 1), textAlign: "left", fontWeight: "bold" }}>{formatWeekRange(row.week)}</td>
              {row.dayCells.map(cell => (
                <td key={cell.dateStr} style={tdStyle(i % 2 === 1)}>
                  <StatusBadge label={cell.label} />
                </td>
              ))}
              <td style={{ ...tdStyle(i % 2 === 1), fontWeight: "bold" }}>{row.weeklyPct === null ? "—" : `${row.weeklyPct}%`}</td>
              <td style={{ ...tdStyle(i % 2 === 1), fontWeight: "bold", color: NAVY }}>{row.runningPct === null ? "—" : `${row.runningPct}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

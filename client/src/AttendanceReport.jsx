import { WEEKDAYS, SEMESTER_START, SEMESTER_END, buildWeeks, addDays, formatWeekRange, todayStr, termLabel } from "./scheduleUtils";

function timeToMinutes(t) {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return h * 60 + m;
}

function sessionHours(session) {
  const mins = timeToMinutes(session.endTime) - timeToMinutes(session.startTime);
  return mins > 0 ? mins / 60 : 0;
}

function fmtHours(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtPct(n) {
  return n === null ? "—" : `${n}%`;
}

export function computeAttendanceReport(unitCode, semester, sessions, records) {
  const today = todayStr();
  const unitSessions = (sessions || []).filter(s => s.unitCode === unitCode && s.semester === semester);
  const hoursByWeekday = {};
  unitSessions.forEach(s => {
    hoursByWeekday[s.dayOfWeek] = (hoursByWeekday[s.dayOfWeek] || 0) + sessionHours(s);
  });
  const recordsByDate = {};
  (records || []).filter(r => r.unitCode === unitCode).forEach(r => { recordsByDate[r.date] = r.status; });

  const allWeeks = buildWeeks(SEMESTER_START, SEMESTER_END);

  let cumAttended = 0;
  let cumClassHours = 0;
  let remainingScheduled = 0;

  const weeks = allWeeks.map((week, idx) => {
    let weekAttended = 0;
    let weekClassHours = 0;
    const dayCells = WEEKDAYS.map((wd, di) => {
      const dateStr = addDays(week.start, di);
      const scheduled = hoursByWeekday[wd] || 0;
      if (scheduled <= 0) return { label: "NC", dateStr };
      weekClassHours += scheduled;
      if (dateStr > today) {
        remainingScheduled += scheduled;
        return { label: "-", dateStr };
      }
      const status = recordsByDate[dateStr];
      if (!status) return { label: "-", dateStr };
      const attendedHours = status === "Present" ? scheduled : 0;
      weekAttended += attendedHours;
      cumAttended += attendedHours;
      cumClassHours += scheduled;
      return { label: fmtHours(attendedHours), dateStr };
    });

    return {
      week,
      term: termLabel(idx),
      dayCells,
      studyHrs: weekAttended,
      weeklyClassHrs: weekClassHours,
      weeklyAttdPct: weekClassHours > 0 ? Math.round((weekAttended / weekClassHours) * 100) : null,
      cumAttendedSnapshot: cumAttended,
      cumClassHoursSnapshot: cumClassHours
    };
  });

  const semesterProjPct = (cumClassHours + remainingScheduled) > 0
    ? Math.round(((cumAttended + remainingScheduled) / (cumClassHours + remainingScheduled)) * 100)
    : null;

  const rows = weeks.map(w => ({
    ...w,
    currAttdPct: w.cumClassHoursSnapshot > 0 ? Math.round((w.cumAttendedSnapshot / w.cumClassHoursSnapshot) * 100) : null,
    projAttdPct: semesterProjPct
  }));

  const terms = Array.from(new Set(weeks.map(w => w.term)));

  return { rows, terms };
}

export default function AttendanceReport({ unitCode, semester, term, sessions, records }) {
  if (!unitCode) {
    return <div style={{ fontSize: 13, color: "#888" }}>Select a unit to view its attendance report.</div>;
  }

  const { rows: allRows } = computeAttendanceReport(unitCode, semester, sessions, records);
  const rows = allRows.filter(r => r.term === term);

  const headerStyle = { background: "#eceef1", color: "#1a1d24", fontWeight: "bold", padding: "9px 10px", fontSize: 11.5, textAlign: "center", border: "1px solid #d3d7dd", whiteSpace: "nowrap" };
  const cellStyle = (shaded) => ({ background: shaded ? "#f7f8fa" : "white", color: "#222", padding: "8px 10px", fontSize: 12, textAlign: "center", border: "1px solid #e2e5ea", whiteSpace: "nowrap" });

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={headerStyle}>Term</th>
              <th style={headerStyle}>Week Length</th>
              {WEEKDAYS.map(wd => <th key={wd} style={headerStyle}>{wd}</th>)}
              <th style={headerStyle}>Study Hrs</th>
              <th style={headerStyle}>Other Hrs</th>
              <th style={headerStyle}>Weekly Attd Hrs</th>
              <th style={headerStyle}>Weekly Class Hrs</th>
              <th style={headerStyle}>Weekly Attd%</th>
              <th style={headerStyle}>Semester Curr. Attd%</th>
              <th style={headerStyle}>Semester Proj. Attd%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={17} style={cellStyle(false)}>No weeks in this term.</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.week.start}>
                <td style={cellStyle(i % 2 === 1)}>{row.term}</td>
                <td style={{ ...cellStyle(i % 2 === 1), textAlign: "left", fontWeight: "bold" }}>{formatWeekRange(row.week)}</td>
                {row.dayCells.map(cell => (
                  <td key={cell.dateStr} style={cellStyle(i % 2 === 1)}>{cell.label}</td>
                ))}
                <td style={{ ...cellStyle(i % 2 === 1), fontWeight: "bold" }}>{fmtHours(row.studyHrs)}</td>
                <td style={cellStyle(i % 2 === 1)}>0</td>
                <td style={cellStyle(i % 2 === 1)}>{fmtHours(row.studyHrs)}</td>
                <td style={cellStyle(i % 2 === 1)}>{fmtHours(row.weeklyClassHrs)}</td>
                <td style={{ ...cellStyle(i % 2 === 1), fontWeight: "bold" }}>{fmtPct(row.weeklyAttdPct)}</td>
                <td style={{ ...cellStyle(i % 2 === 1), fontWeight: "bold" }}>{fmtPct(row.currAttdPct)}</td>
                <td style={{ ...cellStyle(i % 2 === 1), fontWeight: "bold" }}>{fmtPct(row.projAttdPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#888", lineHeight: 1.7 }}>
        <div><strong>Weekly Attd%</strong> — hours attended this week ÷ scheduled class hours this week × 100.</div>
        <div><strong>Semester Curr. Attd%</strong> — cumulative hours attended so far ÷ cumulative scheduled class hours so far × 100.</div>
        <div><strong>Semester Proj. Attd%</strong> — projected final attendance % assuming 100% attendance for all remaining classes this semester.</div>
      </div>
    </div>
  );
}

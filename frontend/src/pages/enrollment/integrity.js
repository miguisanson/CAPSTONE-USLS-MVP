// The server checks that the enrollment ledger, the Monitoring Sheet, the student profile and the portal agree
// (`data.integrity`). The page no longer shows that check as a widget (I-081): a clean result shows nothing, and a
// problem is shown next to the subject it is about. This file turns the server's list into those notes.

/** Issue text for a row, in plain words. */
function noteFor(issue) {
  if (issue.type === "Monitoring/profile mismatch") {
    return `This subject's status differs from the Monitoring Sheet: ${issue.message}`;
  }
  return issue.message;
}

/**
 * @param integrity  `data.integrity` from /api/enrollment (may be missing)
 * @param student    the selected student (id)
 * @param offered    the offered-subject rows (course_code)
 * @returns {{ byCode: Record<string, string[]>, general: string[] }}
 *   byCode  notes for a subject that is on the table, keyed by subject code
 *   general notes about this student that do not belong to one table row
 * Issues about other students are not shown here: they are not about the record on screen.
 */
export function integrityNotes(integrity, student, offered) {
  const byCode = {};
  const general = [];
  if (!integrity || !student) return { byCode, general };
  const codes = new Set((offered || []).map((row) => row.course_code));
  for (const issue of integrity.issues || []) {
    if (issue.student_id !== student.id) continue;
    // `line` reads "<student number> · <subject code>" for subject issues
    const code = String(issue.line || "").split(" · ")[1];
    if (code && codes.has(code)) {
      (byCode[code] ||= []).push(noteFor(issue));
    } else {
      general.push(issue.message);
    }
  }
  return { byCode, general };
}

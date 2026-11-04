// Is enrollment open? (I-355) Subjects may be added or changed only in the enrollment period, so every page that adds or
// changes a subject shows the same banner and turns its controls off while the period is closed. The period is the term's
// planning window (`planning_window_open` .. `planning_window_close`, set in Term settings). Plain JavaScript on purpose:
// Node can import it (scripts/enrollment-period.test.mjs).
// shortcut: the screen decides from the term's dates; the server does not refuse a change after the window yet
// (see the packet report: POST /api/enrollment and /api/student-portal/enrollment should check the same window).

export const CLOSED_REASON = "Enrollment is closed. Changes can only be made during the enrollment period.";

/**
 * @param term   a term as the API sends it ({ planning_window_open, planning_window_close }); null gives null
 * @param today  YYYY-MM-DD in Philippine time (todayISO())
 * @returns      { state: "open"|"closed", closed, until, since, opens, reason } or null.
 *               With no dates at all the period counts as open and `until` is null.
 */
export function enrollmentPeriod(term, today) {
  if (!term) return null;
  const open = term.planning_window_open || null;
  const close = term.planning_window_close || null;
  if (close && today > close) return { state: "closed", closed: true, since: close, reason: CLOSED_REASON };
  if (open && today < open) return { state: "closed", closed: true, opens: open, reason: CLOSED_REASON };
  return { state: "open", closed: false, until: close, reason: "" };
}

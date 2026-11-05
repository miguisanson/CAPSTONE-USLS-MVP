// The banner every page that adds or changes a subject shows at its top (I-355): "Enrollment is OPEN until <date>" or
// "Enrollment is CLOSED since <date> - changes can only be made during the enrollment period". The page also turns its
// add / change controls off while it is closed (use `useEnrollmentPeriod(term).reason` as their hint).
import { CalendarCheck, CalendarX } from "lucide-react";
import { enrollmentPeriod } from "../../lib/enrollmentPeriod";
import { formatDate, todayISO } from "../../lib/format";
import { toneOf } from "../../lib/tone";

/** The period of a term for today (Philippine time). `null` while there is no term. */
export function useEnrollmentPeriod(term) {
  return enrollmentPeriod(term, todayISO());
}

export function EnrollmentBanner({ term, className = "" }) {
  const period = useEnrollmentPeriod(term);
  if (!period) return null;
  const closed = period.closed;
  const Icon = closed ? CalendarX : CalendarCheck;
  const tone = toneOf(closed ? "danger" : "success");
  let headline;
  if (!closed) headline = period.until ? `Enrollment is OPEN until ${formatDate(period.until)}` : "Enrollment is OPEN";
  else if (period.since) headline = `Enrollment is CLOSED since ${formatDate(period.since)}`;
  else headline = `Enrollment is CLOSED until ${formatDate(period.opens)}`;
  const detail = closed
    ? "Changes can only be made during the enrollment period."
    : period.until
      ? "Subjects can be added or changed until then. After that date, changes are not allowed."
      : "The Graduate School has not set a closing date for this semester yet.";
  return (
    <div
      role="status"
      data-enrollment-banner=""
      data-state={period.state}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tone.notice} ${className}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold">{headline}</p>
        <p className="mt-0.5 text-sm">{detail}</p>
      </div>
    </div>
  );
}

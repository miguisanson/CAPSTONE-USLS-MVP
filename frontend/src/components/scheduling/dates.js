import { parseDay } from "../calendar/CalendarView";

// Dates arrive as YYYY-MM-DD (naive Philippine time). Always parsed as local dates.
export function longDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(parseDay(value));
}

export function shortTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).slice(0, 5).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

// "Entered - updated Oct 1, 2026", "Google Calendar", or "Availability not entered".
export function availabilityLabel(participant) {
  if (!participant) return "Availability not entered";
  if (participant.availability_source === "google_calendar") return "Google Calendar";
  if (participant.availability_entered || participant.availability_source === "entered") {
    return participant.availability_updated_at
      ? `Entered - updated ${longDate(participant.availability_updated_at)}`
      : "Entered";
  }
  return "Availability not entered";
}

export function isAvailabilityEntered(participant) {
  return Boolean(participant) && participant.availability_source !== "not_entered" &&
    (participant.availability_entered || participant.availability_source === "entered" || participant.availability_source === "google_calendar");
}

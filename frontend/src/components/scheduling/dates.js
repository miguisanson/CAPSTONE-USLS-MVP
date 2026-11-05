import { formatDate } from "../../lib/format";

// Dates arrive as YYYY-MM-DD (naive Philippine time); the style is the app-wide one in lib/format (I-207).
export const longDate = (value) => (value ? formatDate(value) : "");

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

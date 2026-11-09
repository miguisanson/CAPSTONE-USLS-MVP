// One wording for every refused board move or workflow step: the red message always starts with "Nothing was changed."
// and then gives the reason. Used by the Kanban boards (drag, "Move to..." menu, card buttons) and by step dialogs that
// show a server rejection, so Graduation, Practicum and Withdrawal say it the same way.
export const NOTHING_CHANGED = "Nothing was changed.";

export function refusalMessage(reason, fallback = "That step is not allowed.") {
  const text = String(reason || "").trim() || fallback;
  if (/^nothing was changed\b/i.test(text)) return text;
  return `${NOTHING_CHANGED} ${text}`;
}

// "Exported once" / "Exported twice" / "Exported 3 times", the same wording on every Registrar list.
export function exportCountText(count) {
  const n = Number(count) || 0;
  if (n <= 1) return "Exported once";
  if (n === 2) return "Exported twice";
  return `Exported ${n} times`;
}

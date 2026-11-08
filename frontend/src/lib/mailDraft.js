// After an export, the portal opens a pre-filled email so a person can send the file (owner 2026-11-08).
// The portal never sends mail itself, and a web page cannot attach a file to Gmail: the user drags the downloaded file in.
// Gmail comes first; the computer's own mail app (mailto:) is the fallback.

export function gmailComposeUrl({ to = "", subject = "", body = "" }) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function mailAppUrl({ to = "", subject = "", body = "" }) {
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(to)}?${query}`;
}

// Opens Gmail in a new tab right after the download. A browser can still block the tab (and does not say so with
// "noopener"), so the export window always shows "Open Gmail" and "Use my mail app" buttons as well.
export function openGmailDraft(draft) {
  try {
    window.open(gmailComposeUrl(draft), "_blank", "noopener");
  } catch {
    // blocked: the buttons in the export window are the way in
  }
}

// The words of the email, so every export says the same thing.
export function registrarDraft({ to, fileLabel, filename, what }) {
  const today = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  return {
    to: to || "",
    subject: `${fileLabel[0].toUpperCase()}${fileLabel.slice(1)}${what ? ` - ${what}` : ""} (${today})`,
    body:
      `Good day.\n\nAttached is the ${fileLabel} (${filename}) exported from the USLS Graduate School portal on ${today}.\n\n` +
      "Kindly acknowledge receipt of this email.\n\nThank you.\n",
  };
}

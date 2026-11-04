// Whether this browser shows the Demo Guide (owner request 2026-11-04). Off unless the presenter turns it on at the sign-in page,
// so panelists on the public site never see it. Per browser; every storage use is in try/catch (a private window just reads "off").
const KEY = "usls-demo-guide-on";
const EVENT = "demo-guide:pref";

export function guideEnabled() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuideEnabled(on) {
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* off stays off */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: Boolean(on) }));
}

export const SAVED_KEY = "usls-demo-guide"; // the panel's own memory (DemoGuide.jsx): chosen demo, open, collapsed, dock side, finished steps

/** "Start a guided demo": switch the guide on, lock into the slideshow (autopilot bar), and have the panel open on `guideId` at its first step
 * (earlier marks of that demo are cleared). On a phone the panel starts collapsed so it does not sit on the bar. */
export function startGuide(guideId) {
  setGuideEnabled(true);
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "{}") || {};
    const done = { ...(saved.done || {}) };
    delete done[guideId];
    window.localStorage.setItem(SAVED_KEY, JSON.stringify({ ...saved, guideId, open: true, mini: window.innerWidth < 640, slideshow: true, done }));
  } catch {
    /* the guide still turns on; the panel then asks which demo */
  }
}

/** Calls `fn(on)` when the switch changes here or in another tab. Returns the cleanup. */
export function watchGuideEnabled(fn) {
  const onEvent = (event) => fn(Boolean(event.detail));
  const onStorage = (event) => event.key === KEY && fn(guideEnabled());
  window.addEventListener(EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}

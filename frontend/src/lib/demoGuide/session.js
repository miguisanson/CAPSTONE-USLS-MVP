// The two one-click moves of the Demo Guide, as plain functions so the sign-in page, the panel and (later) the autopilot's Next
// all use the same code. No React.
import { api } from "../../api";
import { startGuide } from "./prefs.js";

const asPage = (route) => (Array.isArray(route) ? route[0] : route);

/** Who a guide starts as, and where: the first main step's account and page. */
export function firstStop(guide) {
  const first = guide.steps.find((item) => !item.side);
  return { account: guide.accounts[first.role], page: asPage(first.route) };
}

/**
 * "Start a guided demo": sign in as the first step's account with the shared demo password, then turn the guide on with the
 * panel open at step 1. Throws the server's message when the sign-in fails (the guide stays as it was). Returns the page to open.
 * The caller refreshes the session (useAuth().refresh) afterwards.
 */
export async function startDemoSession(guide, password) {
  const { account, page } = firstStop(guide);
  await resetSandbox(); // every run starts from the same fresh data
  await api.login({ email: account.email, password });
  startGuide(guide.id);
  return page;
}

/** A fresh private copy of the demo data. An old server (404) or a network error is ignored: the run just goes on with the data as it is. */
async function resetSandbox() {
  try {
    await api.resetDemoSandbox();
  } catch {
    /* old server: continue */
  }
}

/**
 * The one way to start a guide from inside the app (panel pick, "Change demo" then another guide, "Start over"): reset the data,
 * clear that guide's marks (startGuide), sign out and sign in as the first step's person, who lands on step 1's page. Leaves the page.
 * (The sign-in page does the same with startDemoSession, because nobody is signed in there.)
 */
export async function startFromTop(guide) {
  const { account, page } = firstStop(guide);
  await resetSandbox();
  startGuide(guide.id);
  await switchToAccount(account.email, page);
}

/** "Switch to <role>": sign out, then the sign-in page signs in as `email` by itself (go=1) and returns to `to`. Leaves the page. */
export async function switchToAccount(email, to) {
  try {
    await api.logout();
  } catch {
    /* the sign-in page still opens */
  }
  window.location.assign(`/login?as=${encodeURIComponent(email)}&go=1${to ? `&to=${encodeURIComponent(to)}` : ""}`);
}

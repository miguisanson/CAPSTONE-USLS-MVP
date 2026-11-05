// The slideshow controller of the Demo Guide (.planning/demo-guide/DESIGN.md, "Autopilot"). One step at a time:
//   Next    = switch to the step's person if needed -> open the step's page -> play its actions -> read the record
//             (GET /api/demo/guide-state) and only then call the step done.
//   Take over / Esc = stop the player, remove the shield; the presenter works freely and the guide keeps following the record.
//   An action that cannot run, or a record that does not match: the run stops on that step with the reason.
// The step to play is never kept here: the caller passes the step the record says is next (engine.resolveStep), so a presenter
// who did something different is picked up by the next press of Next.
import { useCallback, useEffect, useRef, useState } from "react";
import { Aborted, AutopilotError, clearStage, runActions, showShield, sleep } from "./autopilot.js";
import { isDone, roleMatches, routeMatches } from "./engine.js";
import { switchToAccount } from "./session.js";

const RESUME_KEY = "usls-demo-autopilot-resume"; // { guideId, stepId }: the step to play right after a sign-in as another person (sessionStorage)

const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);
const firstRoute = (step) => asList(step.route)[0];

export function rememberResume(value) {
  try {
    window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(value));
  } catch {
    /* without storage the run stops after the sign-in and Next continues from the record */
  }
}
export function takeResume() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(RESUME_KEY) || "null");
    window.sessionStorage.removeItem(RESUME_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * props: { guide, role, fetchState(): Promise<state>, writes (list), markDone(stepId), afterStep(), navigate(route) }
 * returns { status: "idle" | "running" | "paused" | "error", caption, error, play(step), takeOver(), stop() }
 */
export function useAutopilot(props) {
  const [view, setView] = useState({ status: "idle", caption: "", error: null, stepId: null });
  const latest = useRef(props);
  latest.current = props;
  const control = useRef(null);

  const finish = useCallback(() => {
    clearStage();
    control.current = null;
  }, []);

  const takeOver = useCallback(() => {
    if (control.current) control.current.abort();
    finish();
    setView((current) => ({ status: "paused", caption: "", error: null, stepId: current.stepId }));
  }, [finish]);

  const play = useCallback(
    async (step) => {
      if (control.current) return;
      const controller = new AbortController();
      control.current = controller;
      const { signal } = controller;
      const { guide } = latest.current;
      const say = (caption) => setView((current) => ({ ...current, caption }));
      setView({ status: "running", caption: "", error: null, stepId: step.id });
      showShield();
      const go = async (route) => {
        latest.current.navigate(route);
        const until = Date.now() + 8000;
        while (!routeMatches({ route }, window.location.pathname)) {
          if (Date.now() > until) throw new AutopilotError("The page did not open.");
          await sleep(100, signal);
        }
        await sleep(300, signal);
      };
      // Idempotent: after the sign-in the step starts again from its first action, where this one finds the right person.
      const signInAs = async (roleKey) => {
        const account = guide.accounts[roleKey];
        if (!account) throw new AutopilotError(`This demo has no account for ${roleKey}.`);
        if (roleMatches({ role: roleKey }, latest.current.role)) return;
        rememberResume({ guideId: guide.id, stepId: step.id });
        await switchToAccount(account.email, firstRoute(step));
        await new Promise(() => {}); // the page is leaving
      };
      try {
        const wanted = asList(step.role)[0];
        if (!roleMatches(step, latest.current.role) && guide.accounts[wanted]) {
          say(`Switching to ${guide.accounts[wanted].who}`);
          rememberResume({ guideId: guide.id, stepId: step.id });
          await switchToAccount(guide.accounts[wanted].email, firstRoute(step));
          await new Promise(() => {}); // the sign-in page signs in by itself and opens the step's page
        }
        if (!routeMatches(step, window.location.pathname)) {
          say("Opening the page");
          await go(firstRoute(step));
        }
        await runActions(step.actions, { signal, go, signInAs, onCaption: say });
        say("Checking the record");
        await confirm(step, signal, latest);
        latest.current.markDone(step);
        finish();
        setView({ status: "idle", caption: "", error: null, stepId: step.id });
      } catch (error) {
        const stopped = error instanceof Aborted || signal.aborted;
        finish();
        if (stopped) return; // takeOver() already set the view
        setView({ status: "error", caption: "", error: error instanceof AutopilotError ? error.message : `Something unexpected stopped the autopilot: ${error.message}`, stepId: step.id });
      }
    },
    [finish],
  );

  const stop = useCallback(() => {
    if (control.current) control.current.abort();
    finish();
    setView({ status: "idle", caption: "", error: null, stepId: null });
  }, [finish]);

  // Esc pauses the run (before the page's own Esc handlers see it, so a dialog does not close under the cursor).
  useEffect(() => {
    if (view.status !== "running") return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      takeOver();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view.status, takeOver]);

  useEffect(() => () => clearStage(), []);

  return { ...view, play, takeOver, stop };
}

/** The record must show the step as done; the answer may lag a moment behind the click, so ask again for a few seconds. */
async function confirm(step, signal, latest) {
  const when = step.doneWhen;
  if (!when || when === "manual") return;
  const until = Date.now() + 8000;
  let last = null;
  for (;;) {
    last = await latest.current.fetchState();
    if (isDone(step, last, window.location.pathname, { writes: latest.current.writes })) return;
    if (Date.now() > until) break;
    await sleep(500, signal);
  }
  const at = last && last.case ? last.case.status_label || last.case.status : "no request yet";
  throw new AutopilotError(`The record did not move as expected. It is at "${at}". Do this step by hand, or try again.`);
}

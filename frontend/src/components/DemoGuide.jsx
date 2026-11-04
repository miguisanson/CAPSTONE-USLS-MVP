// The Demo Guide (owner request 2026-11-04, .planning/demo-guide/DESIGN.md): a launcher in the header and a panel that walks the
// presenters through a demo and keeps working when a panelist asks for something different. Demo mode only: with it off the
// component renders nothing.
//
// The one rule: the guide follows the RECORD, not the clicks. It asks GET /api/demo/guide-state where the case really is
// (after every write, on every page change, and on "Continue from here") and shows the step that matches.
// The engine (lib/demoGuide/engine.js) decides which step; the content is lib/demoGuide/guides.js. The guide never clicks or
// types for the presenter.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Compass, Crosshair, EyeOff, ListChecks, PanelLeft, PanelRight, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, InlineNotice, ProgressBar, Select } from "./ui/index.js";
import { GUIDES, RESET_KEYS, guideById } from "../lib/demoGuide/guides.js";
import { sayLine } from "../lib/demoGuide/narration.js";
import { guideEnabled, setGuideEnabled, watchGuideEnabled } from "../lib/demoGuide/prefs.js";
import { ROLE_NAMES, caseStatus, isDone, offScript, resolveStep } from "../lib/demoGuide/engine.js";

const STORE = "usls-demo-guide";

// Progress per browser. Every use is in try/catch: a private window or blocked storage must not break the guide.
function loadSaved() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORE) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
function writeSaved(value) {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(value));
  } catch {
    /* the guide works without it */
  }
}

const cap = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : "");
const mainSteps = (guide) => guide.steps.filter((step) => !step.side);
const firstRoute = (step) => (Array.isArray(step.route) ? step.route[0] : step.route);
const findTarget = (selector) => {
  try {
    const element = selector ? document.querySelector(selector) : null;
    return element && element.getBoundingClientRect().width > 0 ? element : null;
  } catch {
    return null;
  }
};
const calmMotion = () => Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/** A soft ring around the control a step points at. Follows scrolling and resizing; never takes a click. */
function TargetRing({ selector, strong = false }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    if (!selector) {
      setBox(null);
      return undefined;
    }
    const measure = () => {
      let element = null;
      try {
        element = document.querySelector(selector);
      } catch {
        element = null;
      }
      const rect = element ? element.getBoundingClientRect() : null;
      setBox(rect && rect.width > 0 && rect.height > 0 ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null);
    };
    measure();
    const timer = window.setInterval(measure, 500);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [selector]);
  if (!box) return null;
  return createPortal(
    <div
      data-testid="demo-guide-ring"
      data-flash={strong ? "true" : "false"}
      aria-hidden="true"
      className={`pointer-events-none fixed z-header rounded-xl ring-brand-500 ring-offset-2 motion-safe:animate-pulse ${strong ? "bg-brand-500/10 ring-4" : "ring-2"}`}
      style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }}
    />,
    document.body,
  );
}

export default function DemoGuide() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [demoOn, setDemoOn] = useState(false);
  const [saved, setSaved] = useState(loadSaved);
  const [load, setLoad] = useState("idle"); // idle | loading | ok | error
  const [data, setData] = useState(null);
  const [browse, setBrowse] = useState(null); // a main-step index the presenter is looking at, instead of the record's step
  const [refusal, setRefusal] = useState(null);
  const [notice, setNotice] = useState("");
  const [writes, setWrites] = useState([]);
  const [enabled, setEnabled] = useState(guideEnabled);
  const [showMe, setShowMe] = useState(null); // null | "flash" | "missing"
  const [listOpen, setListOpen] = useState(false);
  const [side, setSide] = useState("right");
  const nav = useRef({ index: -1, count: 0, collapsed: false });
  const panelRef = useRef(null);
  const asked = useRef(0);

  const open = enabled && Boolean(saved.open);
  const collapsed = Boolean(saved.mini);
  const preferred = saved.dock === "left" ? "left" : "right";
  const guide = guideById(saved.guideId);
  const doneIds = useMemo(() => new Set((guide && saved.done && saved.done[guide.id]) || []), [guide, saved.done]);
  const followId = guide && saved.follow ? saved.follow[guide.id] : null;

  const update = useCallback((patch) => {
    setSaved((current) => {
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      writeSaved(next);
      return next;
    });
  }, []);

  // Is the guide offered at all? Only in demo mode, only when someone is signed in.
  useEffect(() => {
    if (!user) {
      setDemoOn(false);
      return undefined;
    }
    let active = true;
    api.authConfig().then((config) => active && setDemoOn(Boolean(config.demo_mode))).catch(() => active && setDemoOn(false));
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => watchGuideEnabled(setEnabled), []);

  // Esc collapses the panel to the pill (a second Esc closes it), unless a dialog is open (the dialog takes the Esc).
  // Alt+Right / Alt+Left: next / previous step.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.defaultPrevented || document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      if (event.key === "Escape") update(nav.current.collapsed ? { open: false } : { mini: true });
      else if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowLeft") && nav.current.index >= 0) {
        event.preventDefault(); // Alt+Left would otherwise be the browser's Back
        setBrowse(Math.max(0, Math.min(nav.current.count - 1, nav.current.index + (event.key === "ArrowRight" ? 1 : -1))));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, update]);

  const refresh = useCallback(async () => {
    if (!guide) return;
    const ticket = (asked.current += 1);
    setLoad("loading");
    try {
      const params = { process: guide.process };
      if (followId) params.student_id = followId;
      else if (guide.studentNumber) params.student_number = guide.studentNumber;
      const result = await api.demoGuideState(params);
      if (ticket !== asked.current) return; // an older answer arrives late: ignore it
      setData(result);
      setLoad("ok");
    } catch {
      if (ticket === asked.current) setLoad("error"); // no wrong jump: the last known step stays
    }
  }, [guide, followId]);

  // Read the record when the panel opens, the guide or followed student changes, the page changes or another role signs in.
  useEffect(() => {
    if (demoOn && open && guide) refresh();
  }, [demoOn, open, guide, followId, pathname, user && user.role, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // After each write the app makes: re-read the record (the step moves by itself); a refused write shows its reason.
  useEffect(() => {
    if (!demoOn) return undefined;
    const onWrite = (event) => {
      const write = event.detail || {};
      if (String(write.path || "").startsWith("/demo/")) return;
      if (write.status >= 400 || write.status === 0) {
        if (!String(write.path || "").startsWith("/auth/")) setRefusal(write);
        return;
      }
      setRefusal(null);
      setNotice("");
      setBrowse(null);
      setWrites((list) => [...list.slice(-49), write]);
      if (guide && open) refresh();
    };
    window.addEventListener("demo-guide:api", onWrite);
    return () => window.removeEventListener("demo-guide:api", onWrite);
  }, [demoOn, guide, open, refresh]);

  // Steps finished by the page, the role or a write stay finished (the presenter may leave the page afterwards).
  const liveDone = useMemo(() => {
    const done = new Set(doneIds);
    if (guide && data) {
      for (const step of guide.steps) {
        const when = step.doneWhen;
        if (when && when !== "manual" && !when.status && isDone(step, data, pathname, { writes })) done.add(step.id);
      }
    }
    return done;
  }, [guide, data, pathname, writes, doneIds]);
  useEffect(() => {
    if (guide && liveDone.size !== doneIds.size) update((current) => ({ ...current, done: { ...(current.done || {}), [guide.id]: [...liveDone] } }));
  }, [guide, liveDone, doneIds, update]);

  const resolved = guide && data ? resolveStep(guide, data, pathname, { done: liveDone, writes }) : null;
  const steps = guide ? mainSteps(guide) : [];
  const shown = resolved ? (browse != null && steps[browse] ? steps[browse] : resolved.step) : null;
  const shownIndex = shown ? steps.indexOf(shown) : -1;
  nav.current = { index: shownIndex, count: steps.length, collapsed };
  const issues = shown ? offScript(guide, shown, data, pathname) : [];
  const targetSelector = shown ? shown.target : null;
  const role = data && data.role;
  const canReset = role === "staff" || role === "admin";
  const resetKey = data && data.student ? RESET_KEYS[data.student.student_number] : null;

  // The panel never covers the step's target (desktop): the preferred side wins unless the target sits under it and the other side is free.
  useEffect(() => {
    setSide(preferred);
    if (!open || collapsed || !targetSelector) return undefined;
    const check = () => {
      const panel = panelRef.current;
      const element = findTarget(targetSelector);
      if (!panel || !element || window.innerWidth < 640) return setSide(preferred);
      const box = element.getBoundingClientRect();
      const width = panel.offsetWidth;
      const top = panel.getBoundingClientRect().top;
      const hits = (dock) => {
        const from = dock === "left" ? 16 : window.innerWidth - 16 - width;
        return box.left < from + width && box.right > from && box.bottom > top && box.top < window.innerHeight;
      };
      const other = preferred === "left" ? "right" : "left";
      setSide(hits(preferred) && !hits(other) ? other : preferred);
    };
    check();
    const timer = window.setInterval(check, 400);
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
    };
  }, [open, collapsed, targetSelector, preferred, pathname, load]);

  // Show me: scroll to the step's target and draw a stronger ring for 3 seconds; say so when the target is not on this page.
  useEffect(() => {
    setShowMe(null);
  }, [targetSelector, pathname]);
  useEffect(() => {
    if (showMe !== "flash") return undefined;
    const timer = window.setTimeout(() => setShowMe(null), 3000);
    return () => window.clearTimeout(timer);
  }, [showMe]);
  function showTarget() {
    const element = findTarget(targetSelector);
    if (!element) {
      setShowMe("missing");
      return;
    }
    element.scrollIntoView({ block: "center", behavior: calmMotion() ? "auto" : "smooth" });
    setShowMe("flash");
  }

  function choose(id) {
    setBrowse(null);
    setRefusal(null);
    setNotice("");
    setData(null);
    setLoad("idle");
    update({ guideId: id, open: true });
  }
  function toggle() {
    if (open) {
      update({ open: false });
      return;
    }
    update({ open: true, mini: false });
    window.setTimeout(() => panelRef.current && panelRef.current.focus(), 0);
  }
  function resume() {
    setBrowse(null);
    setRefusal(null);
    setNotice("");
    refresh();
  }
  async function signInAs(email) {
    try {
      await api.logout();
    } catch {
      /* the sign-in page still opens */
    }
    window.location.assign(`/login?as=${encodeURIComponent(email)}`);
  }
  async function resetStudent() {
    if (!guide || !resetKey || !data.student) return;
    if (!window.confirm(`Reset ${data.student.name}'s ${guide.title} demo? This clears the requests, messages and staff actions of this demo student.`)) return;
    try {
      const result = await api.resetDemoStudent(resetKey);
      update((current) => ({ ...current, done: { ...(current.done || {}), [guide.id]: [] } }));
      setWrites([]);
      setBrowse(null);
      setRefusal(null);
      setNotice(result.message || "The demo student was reset.");
      refresh();
    } catch (error) {
      setRefusal({ method: "POST", path: "/auth/demo-students/reset", status: 400, message: error.message });
    }
  }
  async function turnOnDateWaits() {
    try {
      await api.setDemoSettings({ skip_date_waits: true });
      refresh();
    } catch (error) {
      setNotice(error.message);
    }
  }
  const markDone = () => {
    if (!guide || !shown) return;
    setBrowse(null);
    update((current) => ({ ...current, done: { ...(current.done || {}), [guide.id]: [...new Set([...((current.done || {})[guide.id] || []), shown.id])] } }));
  };

  if (!demoOn || !enabled) return null;

  const account = shown && guide.accounts ? guide.accounts[shown.role] : null;
  const say = shown ? sayLine(shown.say) : "";
  const dateRelevant = Boolean(shown && shown.dateWait) || Boolean(refusal);
  const dateLine = data && (
    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
      Skip date waits is {data.skip_date_waits ? "on" : "off"}. {data.skip_date_waits ? "Steps that wait for a real date go ahead now." : "A step that waits for a real date is refused until the date comes."}{" "}
      The switch is on the sign-in page.
      {!data.skip_date_waits && (
        <Button size="sm" variant="secondary" className="ml-2" onClick={turnOnDateWaits}>Turn on skip date waits</Button>
      )}
    </p>
  );
  const ahead = resolved && browse != null && shown && shown !== resolved.step;

  const dockClass = side === "left" ? "sm:left-4 sm:right-auto" : "sm:left-auto sm:right-4";
  const stepsDone = guide && resolved ? steps.filter((item, index) => liveDone.has(item.id) || index < resolved.index).length : 0;
  const panel = open ? (
    <section
      ref={panelRef}
      role="region"
      aria-label="Demo guide"
      data-dock={side}
      tabIndex={-1}
      className={`fixed z-drawer flex flex-col overflow-hidden border border-slate-200 bg-white shadow-lift focus:outline-none ${dockClass} ${
        collapsed
          ? `bottom-3 max-w-[calc(100vw-1.5rem)] rounded-full ${side === "left" ? "max-sm:left-3 max-sm:right-auto" : "max-sm:right-3 max-sm:left-auto"}`
          : "bottom-0 left-0 right-0 max-h-[60vh] rounded-t-2xl sm:bottom-4 sm:w-96 sm:max-h-[calc(100vh-6rem)] sm:rounded-2xl"
      }`}
    >
      <div className={`flex items-center gap-2 ${collapsed ? "px-3 py-1.5" : "border-b border-slate-100 px-4 py-2.5"}`}>
        <Compass className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        <h2 className="card-title">Demo guide</h2>
        {guide && shown && shownIndex >= 0 && <span className="meta ml-auto">Step {shownIndex + 1} of {steps.length}</span>}
        {!collapsed && (
          <Button
            variant="icon"
            icon={side === "left" ? PanelRight : PanelLeft}
            aria-label={preferred === "left" ? "Dock to the right" : "Dock to the left"}
            onClick={() => update({ dock: preferred === "left" ? "right" : "left" })}
            className={`max-sm:hidden ${guide && shown && shownIndex >= 0 ? "" : "ml-auto"}`}
          />
        )}
        <Button
          variant="icon"
          icon={collapsed ? ChevronUp : ChevronDown}
          aria-label={collapsed ? "Expand" : "Collapse"}
          aria-expanded={!collapsed}
          onClick={() => update({ mini: !collapsed })}
          className={!collapsed || (guide && shown && shownIndex >= 0) ? "" : "ml-auto"}
        />
        <Button variant="icon" icon={X} aria-label="Close the demo guide" onClick={() => update({ open: false })} />
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
          {!guide && (
            <div className="space-y-2">
              <p className="meta">Pick the demo you are about to show. The guide follows the real record, so it keeps up when you do something different.</p>
              {GUIDES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item.id)}
                  className="block w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="block text-sm font-semibold text-ink">{item.title}</span>
                  <span className="meta block">{item.summary}</span>
                </button>
              ))}
              <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => { update({ open: false }); setGuideEnabled(false); }}>Hide the Demo guide</Button>
            </div>
          )}

          {guide && load === "error" && (
            <InlineNotice tone="warning" title="Could not read the record.">
              The guide keeps its place and does not guess.{" "}
              <button type="button" className="cursor-pointer font-semibold underline" onClick={refresh}>Try again</button>
            </InlineNotice>
          )}

          {guide && data && shown && (
            <>
              <div className="meta">
                <span className="font-semibold text-ink">{guide.title}</span>
                {data.student && <span> · {data.student.name} ({data.student.student_number})</span>}
                <span className="block">Record: {data.case ? data.case.status_label || data.case.status : data.student ? "no request yet" : "not tied to one student"}</span>
              </div>

              {refusal && (
                <InlineNotice tone="danger" title="The app refused that change">
                  <p>{refusal.message || `The change was not accepted (${refusal.status}).`}</p>
                  {shown.rule && <p className="mt-1">The rule behind it: {shown.rule}</p>}
                  <p className="mt-1">The step stays. Fix the entry and try again.</p>
                  {dateLine}
                </InlineNotice>
              )}
              {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
              {resolved.branch && browse == null && <InlineNotice tone="info">{resolved.branch.note}</InlineNotice>}
              {ahead && (
                <InlineNotice tone="info">
                  {steps.indexOf(resolved.step) > shownIndex
                    ? `The record is further on: it is at step ${steps.indexOf(resolved.step) + 1}, ${resolved.step.title}.`
                    : `The record is not that far yet: it is at ${steps.indexOf(resolved.step) >= 0 ? `step ${steps.indexOf(resolved.step) + 1}, ` : ""}${resolved.step.title}.`}
                </InlineNotice>
              )}
              {issues.map((issue) => (
                <InlineNotice key={issue.kind} tone="warning">
                  <p>{issue.message}</p>
                  {issue.fix.type === "signIn" && <Button size="sm" className="mt-2" onClick={() => signInAs(issue.fix.email)}>{issue.fix.label}</Button>}
                  {issue.fix.type === "go" && <Button size="sm" className="mt-2" onClick={() => navigate(issue.fix.to)}>{issue.fix.label}</Button>}
                </InlineNotice>
              ))}

              <div>
                <h3 className="section-title">{shown.title}</h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div><dt className="eyebrow">Who</dt><dd>{cap(ROLE_NAMES[shown.role] === "a student" ? "the student" : (account && account.label) || ROLE_NAMES[shown.role])}{account ? ` · ${account.email}` : ""}</dd></div>
                  <div><dt className="eyebrow">Page</dt><dd>{shown.page}</dd></div>
                  <div><dt className="eyebrow">Do</dt><dd>{shown.do}</dd></div>
                  {say && <div><dt className="eyebrow">Say</dt><dd className="italic">{say}</dd></div>}
                </dl>
              </div>

              {showMe === "missing" && (
                <InlineNotice tone="warning">
                  <p>That control is not on this page.</p>
                  <Button size="sm" className="mt-2" onClick={() => navigate(firstRoute(shown))}>Go to {shown.page}</Button>
                </InlineNotice>
              )}

              {dateRelevant && !refusal && dateLine}

              {shown.ifAsked && shown.ifAsked.length > 0 && (
                <details className="rounded-xl border border-slate-200 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">If a panelist asks</summary>
                  <div className="mt-2 space-y-1.5">
                    {shown.ifAsked.map((item) => (
                      <details key={item.q} className="text-sm">
                        <summary className="cursor-pointer font-semibold text-slate-700">{item.q}</summary>
                        <p className="mt-1 text-slate-600">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </details>
              )}

              {(data.candidates.length > 1 || issues.some((issue) => issue.kind === "status")) && (
                <label className="block">
                  <span className="field-label">Follow another student</span>
                  <Select
                    placeholder="Choose a student"
                    value={String((data.student && data.candidates.some((c) => c.student_id === data.student.id)) ? data.student.id : "")}
                    onChange={(event) => update((current) => ({ ...current, follow: { ...(current.follow || {}), [guide.id]: event.target.value ? Number(event.target.value) : null } }))}
                    options={data.candidates.map((item) => ({ value: String(item.student_id), label: `${item.name} - ${item.status_label}` }))}
                  />
                </label>
              )}

              <div>
                <button
                  type="button"
                  aria-expanded={listOpen}
                  onClick={() => setListOpen((value) => !value)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl text-left text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <ListChecks className="h-4 w-4 text-brand-700" aria-hidden="true" /> All steps
                  <span className="meta ml-auto">{stepsDone} of {steps.length} done</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${listOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <div role="progressbar" aria-label="Steps done" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={stepsDone} className="mt-1.5">
                  <ProgressBar value={(stepsDone / steps.length) * 100} />
                </div>
                {listOpen && (
                  <ol aria-label="All steps" className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {steps.map((item, index) => {
                      const isDone = liveDone.has(item.id) || index < resolved.index;
                      const isCurrent = !resolved.finished ? item === resolved.step : false;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-current={item === shown ? "step" : undefined}
                            onClick={() => setBrowse(index)}
                            className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${item === shown ? "bg-brand-50 font-semibold" : ""}`}
                          >
                            {isDone ? <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className={`h-4 w-4 shrink-0 ${isCurrent ? "fill-brand-500 text-brand-500" : "text-slate-300"}`} aria-hidden="true" />}
                            <span className="min-w-0 flex-1">{index + 1}. {item.title}</span>
                            <span className="meta shrink-0">{isDone ? "Done" : isCurrent ? "Current" : "To do"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="icon" icon={ChevronLeft} aria-label="Previous step" disabled={shownIndex <= 0} onClick={() => setBrowse(Math.max(0, shownIndex - 1))} />
                <Button variant="icon" icon={ChevronRight} aria-label="Next step" disabled={shownIndex < 0 || shownIndex >= steps.length - 1} onClick={() => setBrowse(shownIndex + 1)} />
                <Button size="sm" variant="secondary" onClick={resume}>Continue from here</Button>
                {shown.target && <Button size="sm" variant="secondary" icon={Crosshair} onClick={showTarget}>Show me</Button>}
                {shown.doneWhen === "manual" && <Button size="sm" onClick={markDone}>Done, next step</Button>}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {canReset && resetKey && <Button size="sm" variant="secondary" onClick={resetStudent}>Reset this demo student</Button>}
                {canReset && !resetKey && data.student && <p className="meta">This student is not one of the ready-made demo students, so it cannot be reset here.</p>}
                {!canReset && guide.accounts.staff && data.student && (
                  <p className="meta">
                    Only Graduate School staff can reset a demo student.{" "}
                    <button type="button" className="cursor-pointer font-semibold text-brand-700 underline" onClick={() => signInAs(guide.accounts.staff.email)}>Switch to the staff account</button>
                  </p>
                )}
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => update({ guideId: null })}>Change demo</Button>
                <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => { update({ open: false }); setGuideEnabled(false); }}>Hide the Demo guide</Button>
              </div>
            </>
          )}
          {guide && !data && load === "loading" && <p role="status" className="meta">Reading the record…</p>}
        </div>
      )}
    </section>
  ) : null;

  return (
    <>
      <Button variant="secondary" size="sm" icon={Compass} aria-expanded={open} onClick={toggle}>
        <span className="max-sm:sr-only">Demo guide</span>
      </Button>
      {panel && createPortal(panel, document.body)}
      {open && !collapsed && shown && <TargetRing selector={shown.target} strong={showMe === "flash"} />}
    </>
  );
}

// The slideshow bar of the Demo Guide autopilot (.planning/demo-guide/DESIGN.md, "Autopilot"): Start over / Next / Take over / Stop,
// "Step n of N" with a thin progress bar, and one live region (aria-live="polite") that says what the autopilot is doing.
// There is no Back: a step cannot be undone on the record, so "Start over" resets the data and plays the demo from step 1 again.
// The Left arrow key only looks at the previous step, it undoes nothing (DemoGuide.jsx); the Right arrow is Next.
// It sits above the click-shield (lib/demoGuide/autopilot.js), so Take over and Stop always work. Presentational: the logic is
// lib/demoGuide/useAutopilot.js and the state is DemoGuide.jsx.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Hand, RotateCcw, Square } from "lucide-react";
import { Button, InlineNotice, ProgressBar } from "./ui/index.js";

export default function DemoAutopilotBar({ title, index, count, finished, say, status, caption, error, canNext, onStartOver, onNext, onTakeOver, onRetry, onStop }) {
  const running = status === "running";
  const ref = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The bar never hides the bottom of the page: the page gets room under it, so a submit button can always scroll above the bar.
  // An open dialog gets the same room (index.css, html[data-guide-bar]), so its footer buttons stay clickable.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const room = () => {
      const space = `${el.offsetHeight + 24}px`;
      document.body.style.paddingBottom = space;
      root.style.setProperty("--guide-bar-room", space);
    };
    root.setAttribute("data-guide-bar", "");
    room();
    const watch = new ResizeObserver(room);
    watch.observe(el);
    let frame = 0;
    const check = () => {
      frame = 0;
      setDialogOpen(Boolean(document.querySelector('[data-modal-backdrop] [aria-modal="true"]')));
    };
    const dialogs = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(check);
    });
    dialogs.observe(document.body, { childList: true });
    check();
    return () => {
      watch.disconnect();
      dialogs.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.body.style.paddingBottom = "";
      root.removeAttribute("data-guide-bar");
      root.style.removeProperty("--guide-bar-room");
    };
  }, []);
  // While a dialog is open the bar keeps one line (step, title, buttons) so the dialog has as much room as possible.
  const compact = dialogOpen && !error;
  const shownStep = finished ? count : index + 1;
  return createPortal(
    <section
      ref={ref}
      role="region"
      aria-label="Demo autopilot"
      data-testid="autopilot-bar"
      data-status={status}
      style={{ zIndex: 2147482500 }}
      className="fixed bottom-3 left-1/2 w-[min(46rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift"
    >
      <div role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={count} aria-valuenow={finished ? count : index}>
        <ProgressBar value={count ? ((finished ? count : index) / count) * 100 : 0} />
      </div>
      <div className={compact ? "space-y-1.5 px-4 py-2" : "space-y-2 px-4 py-3"}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="meta" data-testid="autopilot-step">Step {shownStep} of {count}</span>
          <h2 className={`section-title min-w-0 flex-1 ${compact ? "truncate" : "break-words"}`}>{finished ? "That is the whole demo" : title}</h2>
        </div>
        <div aria-live="polite" className={compact ? (running ? "truncate text-sm text-slate-700" : "sr-only") : "min-h-[2.5rem] text-sm text-slate-700"} data-testid="autopilot-caption">
          {running && <p className="font-semibold text-brand-700">{caption || "Starting"}…</p>}
          {!running && status === "paused" && <p>You have the controls. Click and type as you like; Next carries on from where the record is.</p>}
          {!running && status !== "paused" && !error && <p className="italic">{finished ? "Every step is done. Stop closes the slideshow; the guide panel stays." : say}</p>}
        </div>
        {error && (
          <InlineNotice tone="warning" title="The autopilot stopped on this step">
            <p>{error}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onTakeOver}>Do it by hand</Button>
              <Button size="sm" onClick={onRetry}>Try again</Button>
            </div>
          </InlineNotice>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={RotateCcw} disabled={running} onClick={onStartOver} aria-label="Start this demo over from the first step">Start over</Button>
          <Button size="sm" icon={ChevronRight} loading={running} disabled={!canNext} onClick={onNext} data-testid="autopilot-next">Next</Button>
          <Button variant="secondary" size="sm" icon={Hand} disabled={!running && status === "paused"} onClick={onTakeOver}>Take over</Button>
          <Button variant="secondary" size="sm" icon={Square} className="ml-auto" onClick={onStop}>Stop</Button>
        </div>
      </div>
    </section>,
    document.body,
  );
}

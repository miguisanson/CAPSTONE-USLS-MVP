// The Demo Guide's action player (.planning/demo-guide/DESIGN.md, "Autopilot"): plays a step's `actions` on the real page so the
// guide can "do it" for the presenter, with a visible cursor, a ring on the target and typed text. No React, no dependency.
//
//   action   { click: T } | { type: T, text } | { select: T, label | index } | { check: T } | { upload: T, fixture } |
//            { wait: T } | { gone: T } | { go: "/route" } | { signInAs: "role" } | { pause: ms }      (+ optional { caption, timeout, optional: true })
//   target T "name"               -> the element with data-demo="name" (preferred: stable, added to the page's markup);
//            "#id"                 -> the element with that id (the request forms have stable ids such as #loa-start)
//            { demo | css | role + name | label | text, in?, nth? }
//              role+name  an accessible role and a part of its accessible name; label: a form field by its label text;
//              text       the smallest visible element holding that text;  css: a selector (also with `text` to narrow);
//              in         "dialog" (the top dialog) or another target: look only inside it;  nth: which match (default the first).
//
// Every click goes through el.click() (the same code path as a person), React fields through the native value setter plus a
// bubbling `input` event. Nothing is dragged and dropped. An AbortController cancels the run at any await (Take over / Stop).

export class Aborted extends Error {
  constructor() {
    super("The autopilot was stopped.");
    this.name = "Aborted";
  }
}
export class AutopilotError extends Error {}

const FIXTURES = import.meta.glob("./fixtures/*", { query: "?url", import: "default", eager: true });

export const reducedMotion = () => Boolean(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Aborted());
    const timer = window.setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Aborted());
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

// ----------------------------------------------------------------------------------------------- finding elements
const norm = (text) => String(text == null ? "" : text).replace(/\s+/g, " ").trim().toLowerCase();

const ROLE_SELECTOR = {
  button: 'button, [role="button"], input[type="button"], input[type="submit"]',
  link: 'a[href], [role="link"]',
  tab: '[role="tab"]',
  checkbox: 'input[type="checkbox"], [role="checkbox"]',
  radio: 'input[type="radio"], [role="radio"]',
  menuitem: '[role="menuitem"]',
  switch: '[role="switch"]',
  textbox: 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="date"], textarea',
  combobox: "select",
  heading: "h1, h2, h3, h4, h5, h6, [role=heading]",
  row: "tr",
};

function accessibleName(el) {
  const label = el.getAttribute("aria-label");
  if (label) return label;
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const text = by.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || "").join(" ");
    if (text.trim()) return text;
  }
  if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.textContent).join(" ");
  if (el.tagName === "INPUT" && /^(button|submit)$/.test(el.type)) return el.value;
  return el.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || "";
}

const visible = (el) => {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
};

function scopeOf(target, root) {
  const scope = target.in;
  if (!scope) return root;
  if (scope === "dialog") {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(visible);
    return dialogs[dialogs.length - 1] || null;
  }
  return find(scope, root)[0] || null;
}

const asSpec = (target) => {
  if (typeof target === "string") return target.startsWith("#") ? { css: target } : { demo: target };
  if (!target) return {};
  return target.text || target.name ? { ...target, ...(target.text ? { text: stamped(target.text) } : {}), ...(target.name ? { name: stamped(target.name) } : {}) } : target;
};

/** Every visible element that matches the target, in page order (an empty list when none). */
export function find(target, root = document) {
  const spec = asSpec(target);
  const scope = scopeOf(spec, root);
  if (!scope) return [];
  let found;
  if (spec.demo) found = Array.from(scope.querySelectorAll(`[data-demo="${spec.demo}"]`));
  else if (spec.role) {
    const wanted = norm(spec.name);
    found = Array.from(scope.querySelectorAll(ROLE_SELECTOR[spec.role] || `[role="${spec.role}"]`)).filter((el) => {
      if (!wanted) return true;
      const name = norm(accessibleName(el));
      return spec.exact ? name === wanted : name.includes(wanted);
    });
  } else if (spec.label) {
    const wanted = norm(spec.label);
    found = Array.from(scope.querySelectorAll("input, select, textarea")).filter((el) => norm(accessibleName(el)).includes(wanted));
  } else if (spec.css) found = Array.from(scope.querySelectorAll(spec.css));
  else if (spec.text) {
    const wanted = norm(spec.text);
    const all = Array.from(scope.querySelectorAll("*")).filter((el) => norm(el.textContent).includes(wanted));
    found = all.filter((el) => !Array.from(el.children).some((child) => all.includes(child))); // the smallest holders
  } else found = [];
  if (spec.text && (spec.demo || spec.role || spec.css || spec.label)) found = found.filter((el) => norm(el.textContent).includes(norm(spec.text)));
  return found.filter(visible);
}

export function describe(target) {
  if (typeof target === "string") return `the "${target}" control`;
  const spec = target || {};
  const base = spec.demo ? `the "${spec.demo}" control` : spec.role ? `the ${spec.role} "${spec.name || ""}"` : spec.label ? `the field "${spec.label}"` : spec.text ? `"${spec.text}"` : spec.css || "the control";
  return spec.in ? `${base} in ${spec.in === "dialog" ? "the open window" : describe(spec.in)}` : base;
}

/** Waits until the target is on the page (and, for `enabled`, not disabled). Rejects with a readable message after `timeout` ms. */
export function waitFor(target, { signal, timeout = 8000, enabled = false, gone = false } = {}) {
  const spec = asSpec(target);
  const pick = () => {
    const list = find(spec);
    if (gone) return list.length === 0 ? true : null;
    const usable = enabled ? list.filter((el) => !el.disabled && el.getAttribute("aria-disabled") !== "true") : list;
    return usable[spec.nth || 0] || null;
  };
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Aborted());
    const done = (fn, value) => {
      observer.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(limit);
      if (signal) signal.removeEventListener("abort", onAbort);
      fn(value);
    };
    const check = () => {
      const hit = pick();
      if (hit) done(resolve, hit);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const timer = window.setInterval(check, 150); // layout changes (a column scrolling into view) raise no mutation
    const limit = window.setTimeout(
      () => done(reject, new AutopilotError(gone ? `${describe(spec)} did not go away.` : `Could not find ${describe(spec)} on this page.`)),
      timeout,
    );
    const onAbort = () => done(reject, new Aborted());
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

// ----------------------------------------------------------------------------------------------- the stage: cursor, ring, shield
const Z = { shield: 2147482000, ring: 2147482800, cursor: 2147483000 };
const stage = { cursor: null, ring: null, shield: null, x: null, y: null };

function layer(name, css) {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.testid = name;
  el.setAttribute("data-testid", name);
  Object.assign(el.style, css);
  document.body.appendChild(el);
  return el;
}

function cursorEl() {
  if (stage.cursor && stage.cursor.isConnected) return stage.cursor;
  const el = layer("demo-cursor", { position: "fixed", left: "0", top: "0", width: "28px", height: "28px", pointerEvents: "none", zIndex: String(Z.cursor), opacity: "0", transition: "opacity 200ms" });
  el.innerHTML =
    '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3l16 9.2-7 1.8-3.4 6.6L5 3z" fill="#0f172a" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  stage.cursor = el;
  if (stage.x == null) {
    stage.x = Math.round(window.innerWidth * 0.78);
    stage.y = Math.round(window.innerHeight * 0.7);
  }
  el.style.transform = `translate(${stage.x}px, ${stage.y}px)`;
  return el;
}

function ringEl() {
  if (stage.ring && stage.ring.isConnected) return stage.ring;
  stage.ring = layer("demo-ring", { position: "fixed", left: "0", top: "0", pointerEvents: "none", zIndex: String(Z.ring), borderRadius: "12px", boxShadow: "0 0 0 3px #1c9a59, 0 0 0 7px rgba(28, 154, 89, 0.28)", opacity: "0", transition: "opacity 200ms" });
  return stage.ring;
}

/** The click-shield: an invisible layer over the page while a run plays, so a stray click cannot change the page. */
export function showShield() {
  if (stage.shield && stage.shield.isConnected) return;
  stage.shield = layer("demo-shield", { position: "fixed", inset: "0", zIndex: String(Z.shield), cursor: "progress", background: "transparent" });
}
export function hideShield() {
  if (stage.shield) stage.shield.remove();
  stage.shield = null;
}
/** Removes cursor, ring and shield (Take over, Stop, end of a run). */
export function clearStage() {
  hideShield();
  for (const key of ["cursor", "ring"]) {
    if (stage[key]) stage[key].remove();
    stage[key] = null;
  }
}

function placeRing(el) {
  const ring = ringEl();
  const rect = el.getBoundingClientRect();
  Object.assign(ring.style, { transform: `translate(${rect.left - 4}px, ${rect.top - 4}px)`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px`, opacity: "1" });
}
const hideRing = () => stage.ring && (stage.ring.style.opacity = "0");

/** Scrolls the target to the middle of the screen and waits until it stops moving (smooth scrolling raises no event). */
async function bringIntoView(el, signal) {
  el.scrollIntoView({ block: "center", inline: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  let last = null;
  let still = 0;
  for (let i = 0; i < 40 && still < 3; i += 1) {
    await sleep(40, signal);
    const rect = el.getBoundingClientRect();
    const key = `${Math.round(rect.top)}:${Math.round(rect.left)}`;
    still = key === last ? still + 1 : 0;
    last = key;
  }
}

async function glideTo(el, signal) {
  await bringIntoView(el, signal);
  const rect = el.getBoundingClientRect();
  const x = Math.round(Math.min(Math.max(rect.left + Math.min(rect.width / 2, 120), 4), window.innerWidth - 30));
  const y = Math.round(Math.min(Math.max(rect.top + rect.height / 2, 4), window.innerHeight - 30));
  const cursor = cursorEl();
  cursor.style.opacity = "1";
  const to = `translate(${x}px, ${y}px)`;
  if (reducedMotion()) {
    cursor.style.transform = to;
  } else {
    const animation = cursor.animate([{ transform: `translate(${stage.x}px, ${stage.y}px)` }, { transform: to }], { duration: 600, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)", fill: "forwards" });
    const cancel = () => animation.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await animation.finished;
    } catch {
      throw new Aborted();
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    cursor.style.transform = to;
    animation.cancel();
  }
  stage.x = x;
  stage.y = y;
  placeRing(el);
  if (signal.aborted) throw new Aborted();
}

function pulse() {
  if (reducedMotion() || !stage.cursor) return;
  const dot = layer("demo-click", { position: "fixed", left: "0", top: "0", width: "36px", height: "36px", borderRadius: "50%", background: "rgba(28, 154, 89, 0.35)", pointerEvents: "none", zIndex: String(Z.cursor - 1) });
  dot.animate(
    [
      { transform: `translate(${stage.x - 14}px, ${stage.y - 14}px) scale(0.3)`, opacity: 0.9 },
      { transform: `translate(${stage.x - 14}px, ${stage.y - 14}px) scale(1.6)`, opacity: 0 },
    ],
    { duration: 420, easing: "ease-out" },
  ).finished.then(() => dot.remove(), () => dot.remove());
}

// ----------------------------------------------------------------------------------------------- the actions
const setValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set; // input, textarea or select prototype
  setter.call(el, value);
};
const fire = (el, ...types) => types.forEach((type) => el.dispatchEvent(new Event(type, { bubbles: true })));

async function pick(target, signal, options) {
  return waitFor(target, { signal, enabled: true, ...options });
}

// "{stamp}" in typed text (and in a target's `text` or `name`) becomes the time of day as six digits, the same all through one demo run (kept in
// sessionStorage, cleared when a demo starts), so a value that must be new (a Student ID, a batch number) is new on every run and the
// later steps can find it again.
const STAMP_KEY = "usls-demo-autopilot-stamp";
function stampNow() {
  try {
    let value = window.sessionStorage.getItem(STAMP_KEY);
    if (!value) {
      value = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
      window.sessionStorage.setItem(STAMP_KEY, value);
    }
    return value;
  } catch {
    return new Date().toTimeString().slice(0, 8).replace(/:/g, "");
  }
}
const stamped = (text) => String(text).replace(/\{stamp\}/g, stampNow);

async function typeInto(el, raw, signal) {
  const text = stamped(raw);
  el.focus();
  const whole = reducedMotion() || /^(date|time|number|file)$/.test(el.type) || text.length < 2;
  setValue(el, "");
  fire(el, "input");
  if (whole) {
    setValue(el, text);
    fire(el, "input", "change");
    return;
  }
  const each = Math.min(35, 1500 / text.length); // ~35 ms a character, never more than ~1.5 s a field
  for (let i = 1; i <= text.length; i += 1) {
    setValue(el, text.slice(0, i));
    fire(el, "input");
    await sleep(each, signal);
  }
  fire(el, "change");
}

async function chooseOption(el, action, signal) {
  const wanted = norm(action.label);
  const options = () => Array.from(el.options || []);
  const match = () => (action.index != null ? options()[action.index] : options().find((o) => norm(o.textContent) === wanted) || options().find((o) => norm(o.textContent).includes(wanted)));
  const until = Date.now() + 8000;
  while (!match()) {
    if (Date.now() > until) throw new AutopilotError(`The list has no option "${action.label}".`);
    await sleep(150, signal);
  }
  setValue(el, match().value);
  fire(el, "input", "change");
}

async function toFile(fixture) {
  const key = Object.keys(FIXTURES).find((path) => path.endsWith(`/${fixture}`));
  if (!key) throw new AutopilotError(`The sample file "${fixture}" is missing.`);
  const blob = await (await fetch(FIXTURES[key])).blob();
  const type = /\.pdf$/.test(fixture) ? "application/pdf" : /\.csv$/.test(fixture) ? "text/csv" : blob.type;
  return new File([blob], fixture, { type });
}

const CAPTIONS = {
  click: (a) => `Clicking ${labelOf(a.click)}`,
  type: (a) => `Typing in ${labelOf(a.type)}`,
  select: (a) => `Choosing ${a.label || "an option"}`,
  check: (a) => `Ticking ${labelOf(a.check)}`,
  upload: () => "Attaching the sample file",
  wait: () => "Waiting for the page",
  go: () => "Opening the page",
};
const labelOf = (target) => (typeof target === "string" ? target.replace(/-/g, " ") : (target && (target.name || target.label || target.text || target.demo)) || "the control");

async function play(action, ctx) {
  const { signal } = ctx;
  if (action.caption || CAPTIONS[Object.keys(action)[0]]) ctx.onCaption && ctx.onCaption(action.caption || CAPTIONS[Object.keys(action)[0]](action));
  if (action.pause != null) return sleep(reducedMotion() ? 0 : action.pause, signal);
  if (action.go) return ctx.go(action.go);
  if (action.signInAs) return ctx.signInAs(action.signInAs);
  if (action.wait != null) {
    await waitFor(action.wait, { signal, timeout: action.timeout || 8000 });
    return undefined;
  }
  if (action.gone != null) {
    await waitFor(action.gone, { signal, gone: true, timeout: action.timeout || 8000 });
    return undefined;
  }
  const key = ["click", "type", "select", "check", "upload"].find((name) => action[name] != null);
  if (!key) throw new AutopilotError(`Unknown autopilot action: ${JSON.stringify(action)}`);
  let el;
  try {
    el = await pick(action[key], signal, { timeout: action.optional ? 1500 : action.timeout || 8000 });
  } catch (error) {
    if (action.optional && error instanceof AutopilotError) return undefined; // "if it is there" (a window that may already be closed)
    throw error;
  }
  await glideTo(key === "upload" ? el.closest("label") || el : el, signal); // a file input is hidden: point at its label
  if (key === "type") {
    pulse();
    el.click();
    await typeInto(el, action.text, signal);
  } else if (key === "select") {
    pulse();
    await chooseOption(el, action, signal);
  } else if (key === "upload") {
    pulse();
    const dt = new DataTransfer();
    dt.items.add(await toFile(action.fixture));
    el.files = dt.files;
    fire(el, "input", "change");
  } else if (key === "check") {
    if (!el.checked) {
      pulse();
      el.click();
    }
  } else {
    pulse();
    el.click();
  }
  await sleep(reducedMotion() ? 0 : 220, signal);
  hideRing();
  return undefined;
}

/** Plays the actions one after the other. ctx = { signal, go(route), signInAs(role), onCaption(text) }. */
export async function runActions(actions, ctx) {
  for (const action of actions || []) {
    if (ctx.signal.aborted) throw new Aborted();
    await play(action, ctx);
    await sleep(reducedMotion() ? 0 : 180, ctx.signal);
  }
}

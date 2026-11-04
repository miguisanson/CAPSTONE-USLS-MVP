// Demo Guide engine (.planning/demo-guide/DESIGN.md): pure functions, no React, no browser. The guide follows the live record
// (the case status on the server, the page open, the role signed in), never the presenter's clicks.
//
//   state  = the answer of GET /api/demo/guide-state ({ role, student, case, candidates, skip_date_waits, ... })
//   route  = window.location.pathname
//   ctx    = { done: Set of step ids already finished by a route / role / write / "Mark done", writes: [{method, path, status}] }

const ADMIN_STANDS_IN_FOR = new Set(["staff"]);

export const ROLE_NAMES = {
  staff: "Graduate School staff",
  dean: "the Dean",
  student: "a student",
  academic_coordinator: "the Academic Coordinator",
  research_coordinator: "the Research Coordinator",
  faculty: "a faculty member",
  admin: "the administrator",
};

/** "none" while the followed student has no case yet (or the guide has no case at all). */
export function caseStatus(state) {
  return state && state.case && state.case.status ? state.case.status : "none";
}

const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

export function roleMatches(step, role) {
  const wanted = asList(step.role);
  return wanted.length === 0 || wanted.includes(role) || (role === "admin" && wanted.some((r) => ADMIN_STANDS_IN_FOR.has(r)));
}

export function routeMatches(step, route) {
  const wanted = asList(step.route);
  const path = String(route || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return wanted.length === 0 || wanted.some((prefix) => (prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`)));
}

/** "POST /monitoring/students/*\/subjects" -> does the write {method, path, status} match and succeed? */
export function writeMatches(pattern, write) {
  const [method, path] = String(pattern).includes(" ") ? String(pattern).split(" ") : [null, pattern];
  if (!write || write.status >= 400 || write.status === 0) return false;
  if (method && write.method !== method) return false;
  const wanted = path.split("/");
  const actual = String(write.path).split("?")[0].split("/");
  return wanted.length === actual.length && wanted.every((segment, index) => segment === "*" || segment === actual[index]);
}

/** Is the step finished? Every key given in `doneWhen` must hold. "manual" is finished only once the presenter marks it. */
export function isDone(step, state, route, ctx = {}) {
  if (ctx.done && ctx.done.has(step.id)) return true;
  const when = step.doneWhen;
  if (!when || when === "manual") return false;
  if (when.status && !asList(when.status).includes(caseStatus(state))) return false;
  if (when.route && !routeMatches({ route: when.route }, route)) return false;
  if (when.roleIs && state && state.role !== when.roleIs) return false;
  if (when.apiWrite && !(ctx.writes || []).some((write) => writeMatches(when.apiWrite, write))) return false;
  return true;
}

const mainSteps = (guide) => guide.steps.filter((step) => !step.side);

/** Every status the script knows about (steps and branches); anything else is "not part of this script". */
export function knownStatuses(guide) {
  const known = new Set(["none", "record"]);
  for (const step of guide.steps) {
    asList(step.doneWhen && step.doneWhen.status).forEach((s) => known.add(s));
    (step.branches || []).forEach((branch) => asList(branch.status).forEach((s) => known.add(s)));
  }
  return known;
}

/**
 * The step the presenter is really at, from the live record.
 * 1. A branch whose status matches wins (the Dean returned or denied: the guide shows that branch).
 * 2. Otherwise start after the furthest step the status already proves done (skip ahead / reload / come back later),
 *    and stop at the first step that is not done.
 * Returns { step, index, branch, finished } (index counts the main steps; a side step has index -1).
 */
export function resolveStep(guide, state, route, ctx = {}) {
  const status = caseStatus(state);
  for (const step of guide.steps) {
    for (const branch of step.branches || []) {
      if (asList(branch.status).includes(status)) {
        const target = guide.steps.find((candidate) => candidate.id === branch.goto);
        if (target) return { step: target, index: mainSteps(guide).indexOf(target), branch, finished: false };
      }
    }
  }
  const steps = mainSteps(guide);
  let furthest = -1;
  steps.forEach((step, index) => {
    const when = step.doneWhen;
    if (when && when !== "manual" && when.status && isDone(step, state, route, {})) furthest = index;
  });
  for (let index = furthest + 1; index < steps.length; index += 1) {
    if (!isDone(steps[index], state, route, ctx)) return { step: steps[index], index, branch: null, finished: false };
  }
  return { step: steps[steps.length - 1], index: steps.length - 1, branch: null, finished: true };
}

/**
 * Why the presenter is off the script, and the fix, for the step being shown. Order: no student, wrong role, wrong page,
 * a status the script does not know. Each item: { kind, message, fix: { type: "signIn" | "go" | "pick" | "reset", label, ... } }.
 */
export function offScript(guide, step, state, route) {
  const issues = [];
  if (!state || !step) return issues;
  if (!roleMatches(step, state.role)) {
    const wanted = asList(step.role)[0];
    const account = (guide.accounts || {})[wanted];
    if (account) {
      issues.push({
        kind: "role",
        message: `This step is for ${account.who}. You are signed in as ${ROLE_NAMES[state.role] || "another role"}.`,
        fix: { type: "signIn", label: `Sign in as ${account.label}`, email: account.email },
      });
    }
  } else if (!routeMatches(step, route)) {
    issues.push({ kind: "page", message: `This step happens on ${step.page || "another page"}.`, fix: { type: "go", label: `Go to ${step.page || "the page"}`, to: asList(step.route)[0] } });
  }
  const status = caseStatus(state);
  if (guide.process !== "reports" && !knownStatuses(guide).has(status)) {
    issues.push({
      kind: "status",
      message: `The record is at "${(state.case && state.case.status_label) || status}", which this script does not cover.`,
      fix: { type: "pick", label: "Follow another student" },
    });
  }
  return issues;
}

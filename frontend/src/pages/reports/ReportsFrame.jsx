// The frame every Reports page shares (I-141, F1): a header, the filters (program, entry cohort, period), a strip of six
// numbers that each open their students, and one tab per question. The staff page and the Dean page differ only in
// their tabs. The address holds the filters and the open tab (?report=stages&program_id=3&period=all), so a reload,
// the Back button and a shared link all land on the same view.
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Minus, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Card, EmptyState, Field, PageHeader, Select, Skeleton, StatusLegend, Tabs } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import ListDialog from "./ListDialog.jsx";
import { DEFAULT_PERIOD, FRAME_KEYS, PERIODS, apiScope, scopeKey } from "./scope.js";

// For these numbers a lower figure is the better one, so "up" is the bad direction.
const LOWER_IS_BETTER = new Set(["behind", "waiting", "decide_days"]);
const UNIT_TEXT = { "%": "%", days: " days" };

// "0 waiting", "at most 10%": the goal itself, so a tile never says "misses target" without naming it.
const targetGoal = (tile, target) => `${target ? "at most " : ""}${target}${tile.key === "waiting" ? " waiting" : UNIT_TEXT[tile.unit] || ""}`;

/** The words, arrow and tone of one tile's comparison. The words carry the meaning; the colour only backs them up. */
export function describeComparison(tile) {
  const c = tile.comparison;
  if (c.kind === "target") {
    return { trend: c.met ? "target-met" : "target-missed", Icon: c.met ? Minus : ArrowUp, tone: c.met ? "text-emerald-700" : "text-red-700", words: `Target: ${targetGoal(tile, c.target)} · ${c.met ? "met" : "missed"}` };
  }
  if (c.kind === "previous_term") {
    const unit = UNIT_TEXT[tile.unit] || "";
    const size = Math.abs(c.delta);
    if (!size) return { trend: "flat", Icon: Minus, tone: "text-slate-600", words: `No change · ${c.text}` };
    const up = c.delta > 0;
    const lower = LOWER_IS_BETTER.has(tile.key);
    const tone = lower ? (up ? "text-red-700" : "text-emerald-700") : "text-slate-600";
    return { trend: up ? "up" : "down", Icon: up ? ArrowUp : ArrowDown, tone, words: `${up ? "Up" : "Down"} ${size}${unit} · ${c.text}` };
  }
  return { trend: "none", Icon: Minus, tone: "text-slate-500", words: c.text.charAt(0).toUpperCase() + c.text.slice(1) };
}

/** The small line under the figure: what it is made of. */
function tileSub(tile) {
  const d = tile.detail;
  if (tile.key === "active") return "Standing Active, not completed or withdrawn"; // the dashboard shares this count (student_is_active, I-193)
  if (tile.key === "behind") return `${tile.count} of ${tile.of} active students`;
  if (tile.key === "decide_days") return tile.count ? `${tile.count} decisions` : "No decisions in this period";
  if (tile.key === "defenses") return `${d.held} held · ${d.next_30_days} in the next 30 days · ${d.awaiting_verdict} waiting for a verdict`;
  if (tile.key === "graduation") return `${d.endorsed_this_term} sent to the Dean · ${d.eligible_now} ready now`;
  return null;
}

function Tile({ tile, onOpen }) {
  const { trend, Icon, tone, words } = describeComparison(tile);
  const unit0 = UNIT_TEXT[tile.unit] ? UNIT_TEXT[tile.unit].trim() : tile.unit;
  const unit = tile.value === 1 ? unit0.replace(/s$/, "") : unit0; // "1 student", not "1 students"
  const sub = tileSub(tile);
  return (
    <button
      type="button"
      onClick={() => onOpen(tile)}
      className="card flex h-full w-full cursor-pointer flex-col gap-1 p-3 text-left sm:p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="text-xs font-semibold text-slate-600">{tile.key === "waiting" ? `All offices: ${tile.label.charAt(0).toLowerCase()}${tile.label.slice(1)}` : tile.label}</span>
      <span className="page-title">
        {tile.value == null ? "-" : tile.value}
        {tile.value != null && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
      </span>
      {sub && <span className="meta">{sub}</span>}
      <span data-comparison="" data-trend={trend} className={`mt-auto inline-flex items-start gap-1 pt-1 text-xs font-semibold ${tone}`}>
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{words}</span>
      </span>
    </button>
  );
}

function scopeSentence(summary, programs, scope) {
  const term = summary.term;
  const last12 = scope.term === "last-12-months";
  const when = last12 ? "Showing the last 12 months" : `Showing ${term?.label || "this period"}`;
  const range = term ? ` (${formatDate(term.start)} to ${formatDate(term.end)})` : "";
  const program = programs.find((p) => String(p.id) === scope.program_id);
  const against = summary.previous_term ? `, compared with ${summary.previous_term.label}` : "";
  const note = last12 ? ". The current term is new, so this shows the decisions and defenses of earlier terms too. Choose This term to see only the current term." : ".";
  return `${when}${range}${program ? ` for ${program.code}` : ""}${scope.cohort ? `, started ${scope.cohort}` : ""}${against}${note}`;
}

export default function ReportsFrame({ title, description, icon, actions, tabs, label = "Reports", children }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("report");
  const active = tabs.find((tab) => tab.id === requested || tab.aliases?.includes(requested)) || tabs[0]; // an alias is an older address of the same tab (?report=graduation)
  const scope = useMemo(() => apiScope(params), [params]);
  const key = scopeKey(scope);
  const { data: meta } = useApi(() => api.meta(), []);
  const showScope = !active.bare;
  const { data: summary, error } = useApi(() => (showScope ? api.reportV2("summary", scope) : Promise.resolve(null)), [showScope, key]);
  const [open, setOpen] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false); // phones only: the filters fold into one button so the numbers come first (I-194)
  const programs = meta?.programs || [];
  const filterCount = ["program_id", "cohort"].filter((name) => params.get(name)).length + (params.get("period") && params.get("period") !== DEFAULT_PERIOD ? 1 : 0);
  const periodLabel = PERIODS.find((p) => p.value === (params.get("period") || DEFAULT_PERIOD))?.label;

  function setParam(name, value) {
    const next = new URLSearchParams(params);
    next.delete("workflow_type");
    next.set("report", active.id);
    if (requested && requested !== active.id && name !== "view" && !next.get("view")) next.set("view", requested); // keep the view an alias asked for
    if (value && !(name === "period" && value === DEFAULT_PERIOD)) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }
  function clearFilters() {
    const keep = params.get("view") || (requested !== active.id ? requested : ""); // Clear filters stays on the same view of the tab
    setParams(new URLSearchParams({ report: active.id, ...(keep ? { view: keep } : {}) }), { replace: true });
  }
  // Program, cohort and period mean the same on every tab, so they stay; a filter only the old tab had is dropped
  // (a hidden filter would narrow rows with no way to see why).
  function chooseTab(id) {
    const target = tabs.find((tab) => tab.id === id);
    const keep = new Set([...FRAME_KEYS, ...(target.filters || [])]);
    const next = new URLSearchParams({ report: id });
    for (const name of keep) if (params.get(name)) next.set(name, params.get(name));
    setParams(next, { replace: false });
  }

  const ctx = { params, setParam, clearFilters, scope, scopeKey: key, summary, programs };

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader title={title} description={description} icon={icon} actions={actions} />
      {children}

      {showScope && (
        <Card>
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <Button variant="secondary" icon={SlidersHorizontal} aria-expanded={filtersOpen} aria-controls="report-filters" onClick={() => setFiltersOpen((on) => !on)}>
              Filters ({filterCount})
            </Button>
            <span className="meta">{periodLabel}</span>
          </div>
          <div
            id="report-filters"
            role="group"
            aria-label="Report filters"
            className={`${filtersOpen ? "mt-3 grid" : "hidden"} grid-cols-2 gap-3 sm:mt-0 sm:grid sm:grid-cols-3 sm:gap-4 max-sm:[&>label:last-child]:col-span-2`}
          >
            <Field label="Program">
              <Select placeholder="All programs" value={params.get("program_id") || ""} onChange={(e) => setParam("program_id", e.target.value)} options={programs.map((p) => ({ value: String(p.id), label: p.code }))} />
            </Field>
            <Field label="Year started">
              <Select placeholder="All years" value={params.get("cohort") || ""} onChange={(e) => setParam("cohort", e.target.value)} options={summary?.options?.cohorts || (params.get("cohort") ? [params.get("cohort")] : [])} />
            </Field>
            <Field label="Period">
              <Select placeholder={null} value={params.get("period") || DEFAULT_PERIOD} onChange={(e) => setParam("period", e.target.value)} options={PERIODS} />
            </Field>
          </div>
          {summary && <p className={`meta mt-3 ${filtersOpen ? "" : "max-sm:hidden"}`}>{scopeSentence(summary, programs, scope)}</p>}
        </Card>
      )}

      {showScope && (
        error ? (
          <EmptyState icon={AlertTriangle} title="Could not load the summary numbers" hint={error} />
        ) : !summary ? (
          <Skeleton lines={4} />
        ) : (
          <div role="group" aria-label="Summary numbers" className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            {summary.tiles.map((tile) => <Tile key={tile.key} tile={tile} onOpen={setOpen} />)}
          </div>
        )
      )}

      <StatusLegend />

      <Tabs label={label} tabs={tabs.map((tab) => ({ key: tab.id, label: tab.label, icon: tab.icon }))} value={active.id} onChange={chooseTab} />
      {active.render(ctx)}

      {open && (
        <ListDialog
          title={open.label}
          subtitle={summary && scopeSentence(summary, programs, scope)}
          endpoint={`summary/${open.key}`}
          params={scope}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpenCheck, CalendarCheck, CheckCircle2, UserX, Users } from "lucide-react";
import { Button, Card, Field, InlineNotice, Input, SectionTitle, Select, StatCard, StatusChip } from "../../components/ui/index.js";
import { Pill } from "../../components/ui";
import { toneOf } from "../../lib/tone";

const PANEL_MATCHING_DEFAULT_LIMIT = 15;

// ---------------------------------------------------------------------------
// Panel Matching
// ---------------------------------------------------------------------------
const PANEL_FLAG_LABELS = {
  overload: "Overloaded",
  unavailable: "Unavailable",
  no_overlap: "No topic match",
  thin_records: "Few expertise records",
};
const PANEL_FLAG_TONES = {
  overload: "warning",
  unavailable: "danger",
  no_overlap: "neutral",
  thin_records: "neutral",
};
const PANEL_COMPONENT_META = [
  { key: "expertise", label: "Expertise match", bar: "bg-brand-600", dot: "bg-brand-600" },
  { key: "availability", label: "Availability", bar: "bg-blue-500", dot: "bg-blue-500" },
  { key: "workload", label: "Workload", bar: "bg-amber-500", dot: "bg-amber-500" },
];
const GRID_COLUMNS = "grid-cols-[minmax(230px,1.1fr)_minmax(260px,1.6fr)_minmax(190px,1fr)_minmax(170px,0.9fr)]";

function PanelScoreBar({ components, total }) {
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Score ${total} of 100: ${PANEL_COMPONENT_META.map((item) => `${item.label} ${components?.[item.key]?.score ?? 0} of ${components?.[item.key]?.max ?? 0}`).join(", ")}`}>
        {PANEL_COMPONENT_META.map((item) => (
          <span key={item.key} className={`block h-full ${item.bar}`} style={{ width: `${Math.max(0, Math.min(100, components?.[item.key]?.score ?? 0))}%` }} />
        ))}
      </div>
      <p className="micro mt-1 whitespace-nowrap">
        {PANEL_COMPONENT_META.map((item) => `${components?.[item.key]?.score ?? 0}/${components?.[item.key]?.max ?? 0}`).join(" · ")}
      </p>
    </div>
  );
}

function PanelCandidateDetail({ candidate, methodLabel }) {
  const breakdown = candidate.breakdown || {};
  const components = breakdown.components || {};
  return (
    <div className="grid gap-4 border-t border-slate-100 bg-white px-4 py-4 text-xs lg:grid-cols-3">
      <div className="space-y-3">
        <p className="eyebrow">How the score was built</p>
        {PANEL_COMPONENT_META.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-slate-600"><i className={`h-2.5 w-2.5 rounded-sm ${item.dot}`} />{item.label}</span>
            <span className="font-semibold text-ink">{components[item.key]?.score ?? 0} / {components[item.key]?.max ?? 0}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2"><span className="font-semibold text-slate-600">Total</span><span className="font-semibold text-ink">{candidate.score} / 100</span></div>
        <p className="text-slate-500">Expertise is scaled across the candidate pool, so the closest match gets full marks and others are proportional. {candidate.availability_windows} conflict-free defense windows; {candidate.workload} other student panel{candidate.workload === 1 ? "" : "s"}.</p>
        <p className="text-slate-500">Method: <span className="font-semibold text-slate-700">{methodLabel || candidate.method_label}</span>{breakdown.similarity !== undefined && <> (similarity {breakdown.similarity})</>}.</p>
      </div>
      <div className="space-y-3">
        <p className="eyebrow">Why this faculty matches</p>
        <p className="leading-relaxed text-slate-700">{breakdown.reason || candidate.note}</p>
        {breakdown.matched_passage ? (
          <blockquote className="rounded-lg border-l-4 border-brand-300 bg-brand-50/60 px-3 py-2 leading-relaxed text-slate-700">
            <span className="eyebrow block text-brand-700">Passage of the paper that matched</span>
            {breakdown.matched_passage}
          </blockquote>
        ) : <p className="text-slate-500">No passage of the paper overlaps with this faculty member's records.</p>}
        {breakdown.ai_rationale && <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><span className="font-semibold">Optional AI note:</span> {breakdown.ai_rationale}</p>}
      </div>
      <div className="space-y-2">
        <p className="eyebrow">Expertise records used</p>
        {(breakdown.evidence || []).length ? breakdown.evidence.map((item, index) => (
          <div key={`${item.kind}-${index}`} className="rounded-lg border border-slate-100 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusChip tone="success" status={item.kind_label} size="sm" dot={false} />
              {item.year && <span className="micro">{item.year}</span>}
              <StatusChip tone={item.source === "demo seed" ? "warning" : "neutral"} status={item.source === "demo seed" ? "Demo data" : item.source} size="sm" dot={false} />
            </div>
            <p className="mt-1 leading-relaxed text-slate-700">{item.text}</p>
            {item.matched?.length > 0 && <p className="mt-1 text-brand-700">Matched: {item.matched.join(", ")}</p>}
          </div>
        )) : <p className="text-slate-500">No expertise record overlaps with the paper. Add records in <Link to={`/faculty?faculty=${candidate.faculty_id}`} className="font-semibold text-brand-700 hover:underline">Faculty Profiles</Link>.</p>}
      </div>
    </div>
  );
}

export function PanelMatchingForm({ context, studentId, submit, submitting, refetch }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [filters, setFilters] = useState({ query: "", specialization: "", college: "", availability: "" });
  const roles = context.panel_roles || [];
  const profile = context.matching_profile || {};
  const recs = profile.ready ? context.panel_recommendations || [] : [];
  const suggested = context.suggested_panel || [];
  const composition = context.panel_composition;
  const excluded = context.excluded_faculty || [];
  const weights = context.matching_weights || { expertise: 60, availability: 25, workload: 15 };
  const methodLabel = context.matching_method_label;
  const searchActive = Object.values(filters).some((value) => value.trim());
  const filteredRecommendations = recs.filter((item) => {
    const query = filters.query.trim().toLowerCase();
    const specialization = filters.specialization.toLowerCase();
    const college = filters.college.toLowerCase();
    const queryHaystack = [
      item.faculty_name,
      item.college,
      item.specialization,
      item.availability_status,
      item.note,
      ...(item.matched_keywords || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return (!query || queryHaystack.includes(query))
      && (!specialization || item.specialization.toLowerCase().includes(specialization))
      && (!college || item.college.toLowerCase().includes(college))
      && (!filters.availability || item.availability_status === filters.availability);
  });
  const visibleRecommendations = searchActive ? filteredRecommendations : recs.slice(0, PANEL_MATCHING_DEFAULT_LIMIT);
  const displayedCandidateIds = new Set(visibleRecommendations.map((item) => item.faculty_id));
  const selectedOutsideView = recs.filter((item) => selectedIds.includes(item.faculty_id) && !displayedCandidateIds.has(item.faculty_id));
  const selectorOptions = [...visibleRecommendations, ...selectedOutsideView];
  const rankByFacultyId = new Map(recs.map((item, index) => [item.faculty_id, index + 1]));
  const defaultLimited = !searchActive && recs.length > PANEL_MATCHING_DEFAULT_LIMIT;
  const finalizedPanel = context.assigned_panel || [];
  const suggestedIds = new Set(suggested.map((item) => item.faculty_id));
  const suggestedRoleById = new Map(suggested.map((item) => [item.faculty_id, item.role]));
  const selectionComplete = selectedIds.length === roles.length && selectedIds.every(Boolean) && new Set(selectedIds).size === roles.length;
  const sourceLabel = profile.source_label || "research manuscript";
  const documentCount = profile.document_count ?? profile.concept_paper_count ?? 0;
  const readableCount = profile.readable_document_count ?? profile.readable_paper_count ?? 0;
  const requiredCount = profile.required_file_count || 1;
  const analysisLabel = profile.analysis_label || "Keyword analysis";
  const suggestedKey = suggested.map((item) => `${item.role}:${item.faculty_id}`).join(",");
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const profileTone = toneOf(profile.ready ? "success" : "warning").notice;

  useEffect(() => {
    const finalizedIds = finalizedPanel.map((item) => item.faculty_id).filter(Boolean);
    const byRole = new Map(suggested.map((item) => [item.role, item.faculty_id]));
    const suggestedSeats = roles.map((role) => byRole.get(role) || "");
    setSelectedIds(finalizedIds.length === roles.length ? finalizedIds : suggestedSeats);
  }, [studentId, roles.join("|"), suggestedKey, finalizedPanel.map((item) => item.faculty_id).join(",")]);

  function onSubmit(e) {
    e.preventDefault();
    if (!profile.ready || !selectionComplete) return;
    let panelChangeReason = "";
    if (finalizedPanel.length > 0) {
      // A panel already exists: replacing it needs a recorded reason (protocol: same panel unless changed with a reason).
      const answer = window.prompt("A panel is already recorded for this stage. Why is it being changed? (recorded with the change; leave empty if nothing changed)");
      if (answer === null) return;
      panelChangeReason = answer.trim();
    }
    submit({ student_id: studentId, faculty_ids: selectedIds, panel_change_reason: panelChangeReason });
  }

  function selectFaculty(index, value) {
    setSelectedIds((current) => {
      const next = [...current];
      next[index] = Number(value) || "";
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle
        title="Panel recommendation workspace"
        subtitle="Review why each faculty member ranks where they do, adjust the suggested panel, then finalize it"
        icon={Users}
        action={<Button as={Link} to="/faculty" variant="secondary" icon={Users}>Faculty profiles</Button>}
      />
      <div className={`rounded-xl border px-4 py-3 ${profileTone}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {profile.ready ? `${sourceLabel} content ready` : profile.blocked_reason || `Readable ${sourceLabel} PDF text is required`}
            </p>
            <p className="mt-1 text-xs">
              {documentCount} of {requiredCount} PDFs uploaded. {readableCount} of {requiredCount} successfully read. Source: {profile.source || "No research evidence yet"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {methodLabel && <StatusChip tone="neutral" status={methodLabel} dot={false} />}
            <StatusChip status={profile.ready ? "Ready" : "Blocked"} tone={profile.ready ? "success" : "warning"} dot={false} />
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-white/60 bg-white/80 px-3 py-2 text-xs">
          <p className="font-semibold">{profile.ready ? `Paper analysis: ${analysisLabel}` : "Waiting for readable paper text"}</p>
          <p className="mt-1 leading-relaxed">
            {profile.ready
              ? context.matching_method_note || "The paper text is compared with each faculty member's recorded expertise before ranking."
              : profile.blocked_reason || "Upload readable source PDFs so the paper can be compared with faculty expertise."}
          </p>
        </div>
        {profile.research_title && <p className="mt-3 text-sm font-medium text-slate-700">Research title <span className="font-normal text-slate-500">(display only; excluded from matching)</span>: {profile.research_title}</p>}
        {profile.keywords?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.keywords.map((keyword) => <Pill key={keyword}>{keyword}</Pill>)}
          </div>
        )}
        {profile.concept_papers?.length > 0 && (
          <div className="mt-4 grid gap-2">
            {profile.concept_papers.slice(0, 3).map((paper) => (
              <div key={paper.id} className="rounded-lg bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={paper.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-brand-700">{paper.name}</a>
                  <StatusChip status={paper.extracted ? "Text extracted" : "No readable text"} tone={paper.extracted ? "success" : "warning"} dot={false} size="sm" />
                </div>
                {paper.keywords?.length > 0 && (
                  <p className="mt-2 text-slate-500">Analyzed keywords: {paper.keywords.slice(0, 5).join(", ")}</p>
                )}
                {paper.excerpt && <p className="mt-2 leading-relaxed text-slate-500">{paper.excerpt}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard size="sm" tone="success" icon={BookOpenCheck} label="Expertise match" value={`${weights.expertise} pts`} sub="paper vs. faculty records" />
        <StatCard size="sm" tone="info" icon={CalendarCheck} label="Availability" value={`${weights.availability} pts`} sub="conflict-free windows" />
        <StatCard size="sm" tone="warning" icon={Users} label="Workload" value={`${weights.workload} pts`} sub="other student panels" />
      </div>
      <div className={`rounded-xl border px-4 py-3 text-sm ${toneOf("neutral").notice}`}>
        {context.research_case_type || "Thesis"} panel needs {roles.length} members: {roles.join(", ")}. Expertise counts most; candidates who share no topic with the paper are listed after those who do.
      </div>

      {excluded.length > 0 && (
        <InlineNotice tone="danger" role="note" icon={UserX} title="Not eligible for this student's panel">
          <ul className="mt-1 space-y-0.5 text-xs">
            {excluded.map((item) => <li key={item.faculty_id}><span className="font-semibold">{item.faculty_name}</span>: {item.reason}</li>)}
          </ul>
        </InlineNotice>
      )}

      <Card pad="sm" className="grid gap-3 shadow-none sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Search faculty"><Input value={filters.query} onChange={setFilter("query")} placeholder="Name, expertise, keyword, department" /></Field>
        <Field label="Specialization"><Input value={filters.specialization} onChange={setFilter("specialization")} placeholder="e.g. analytics" /></Field>
        <Field label="Department / program"><Input value={filters.college} onChange={setFilter("college")} placeholder="Search college" /></Field>
        <Field label="Availability">
          <Select value={filters.availability} onChange={setFilter("availability")} placeholder="All availability" options={["Available", "Limited availability", "No availability recorded"]} />
        </Field>
      </Card>

      {profile.ready && recs.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${toneOf("neutral").notice}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{searchActive ? `Showing ${visibleRecommendations.length} matching faculty from ${recs.length} ranked candidates.` : `Showing the top ${Math.min(PANEL_MATCHING_DEFAULT_LIMIT, recs.length)} ranked candidates.`} The suggested panel is highlighted and preselected; open "Why" on any row to see the evidence.</span>
            {defaultLimited && <span className="font-medium text-brand-700">Use search or filters to find the other {recs.length - PANEL_MATCHING_DEFAULT_LIMIT} faculty.</span>}
          </div>
        </div>
      )}

      {profile.ready && visibleRecommendations.length === 0 && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${toneOf("warning").notice}`}>
          {searchActive ? "No faculty match the current search. Clear or broaden the filters to return to the top 15." : "No eligible faculty profiles were found. Add an active faculty profile with expertise records and availability data, then run matching again."}
        </div>
      )}

      {visibleRecommendations.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200">
        <div className="min-w-[900px] text-sm" role="table" aria-label="Ranked panel candidates">
          <div role="row" className={`grid ${GRID_COLUMNS} border-b border-slate-100 bg-slate-50 text-left`}>
            <div role="columnheader" className="eyebrow px-4 py-2.5">Rank / faculty</div>
            <div role="columnheader" className="eyebrow px-3 py-2.5">Expertise match</div>
            <div role="columnheader" className="eyebrow px-3 py-2.5">Availability &amp; workload</div>
            <div role="columnheader" className="eyebrow px-3 py-2.5 text-right">Score breakdown</div>
          </div>
          <div role="rowgroup">
            {visibleRecommendations.map((r) => {
              const rank = rankByFacultyId.get(r.faculty_id);
              const isSuggested = suggestedIds.has(r.faculty_id);
              const isSelected = selectedIds.includes(r.faculty_id);
              const isOpen = expanded.has(r.faculty_id);
              const rowClass = isSuggested ? "border-l-4 border-l-brand-500 bg-brand-50/70" : isSelected ? "bg-brand-50/50" : "bg-white";
              const flags = r.flags || [];
              const topics = r.breakdown?.matched_topics || r.matched_keywords || [];
              return (
                <div key={r.faculty_id} role="row" className={`border-b border-slate-100 align-top last:border-0 ${rowClass}`}>
                  <div role="cell">
                    <div className={`grid ${GRID_COLUMNS} items-start`}>
                      <div className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${isSuggested ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>{rank}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link to={`/faculty?faculty=${r.faculty_id}`} className="font-semibold text-ink transition-colors hover:text-brand-700 hover:underline">{r.faculty_name}</Link>
                              {isSuggested && <StatusChip tone="success" status={`Suggested: ${suggestedRoleById.get(r.faculty_id)}`} size="sm" dot={false} />}
                              {isSelected && !isSuggested && <StatusChip tone="info" status="Selected" size="sm" dot={false} />}
                            </div>
                            <p className="meta">{r.college}</p>
                            {flags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {flags.map((flag) => (
                                  <StatusChip key={flag.type} tone={PANEL_FLAG_TONES[flag.type] || "neutral"} status={PANEL_FLAG_LABELS[flag.type] || flag.type} title={flag.message} size="sm" dot={false} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-3 text-slate-600">
                        {topics.length > 0
                          ? <div className="flex flex-wrap gap-1">{topics.slice(0, 5).map((topic) => <Pill key={topic} tone="brand">{topic}</Pill>)}</div>
                          : <p className="meta">No distinctive topic in common with the paper</p>}
                        <p className="meta mt-1.5 line-clamp-2">{r.specialization}</p>
                        <button type="button" onClick={() => toggleExpanded(r.faculty_id)} aria-expanded={isOpen} className="mt-1.5 cursor-pointer rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11">{isOpen ? "Hide why" : "Why this score"}</button>
                      </div>
                      <div className="px-3 py-3"><p className="font-medium text-slate-700">{r.availability_status}</p><p className="meta">{r.availability_windows} conflict-free windows</p><p className="meta mt-1">{r.workload} other student panel{r.workload === 1 ? "" : "s"}</p></div>
                      <div className="px-3 py-3 text-right">
                        <StatusChip tone="success" status={`${r.score}/100`} size="sm" dot={false} />
                        <div className="mt-2 text-left"><PanelScoreBar components={r.breakdown?.components} total={r.score} /></div>
                      </div>
                    </div>
                    {isOpen && <PanelCandidateDetail candidate={r} methodLabel={methodLabel} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="meta flex flex-wrap gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2">
          {PANEL_COMPONENT_META.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm ${item.dot}`} />{item.label}</span>)}
        </div>
      </div>}

      {visibleRecommendations.length > 0 && (
        <Card pad="sm" className="bg-slate-50 shadow-none">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Review and adjust the panel set</p>
              <p className="meta mt-0.5">The suggested panel is preselected: the strongest methods profile takes the Method seat and the rest follow by score. Staff may change any role before finalizing.</p>
            </div>
            <StatusChip status={finalizedPanel.length === roles.length ? "Final panel selected" : "Staff review"} tone={finalizedPanel.length === roles.length ? "success" : "warning"} dot={false} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role, index) => (
              <Field key={role} label={role}>
                <Select
                  value={selectedIds[index] || ""}
                  onChange={(event) => selectFaculty(index, event.target.value)}
                  placeholder="Select faculty"
                  options={selectorOptions.map((item) => ({ value: item.faculty_id, label: `#${rankByFacultyId.get(item.faculty_id)} ${item.faculty_name} - ${item.score}/100` }))}
                />
              </Field>
            ))}
          </div>
          {!selectionComplete && <p className="mt-3 text-xs font-medium text-amber-800">Choose a different eligible faculty member for every required role.</p>}
        </Card>
      )}

      {composition && visibleRecommendations.length > 0 && (
        <Card pad="sm" className="shadow-none">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Panel composition rules</p>
            <StatusChip status={composition.satisfied ? "Suggested panel satisfies the protocol" : "Protocol rule not satisfied"} tone={composition.satisfied ? "success" : "danger"} dot={false} />
          </div>
          <ul className="space-y-1.5">
            {composition.checks.map((check) => (
              <li key={check.rule} className="flex items-start gap-2 text-xs">
                {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${check.severity === "required" ? "text-red-600" : "text-amber-600"}`} aria-hidden="true" />}
                <span className={check.ok ? "text-slate-600" : check.severity === "required" ? "font-semibold text-red-700" : "font-semibold text-amber-800"}>{check.message}{check.severity === "advisory" && !check.ok ? " (advisory)" : ""}</span>
              </li>
            ))}
          </ul>
          <p className="meta mt-2">Source: {composition.source}. Checked again on the server when the panel is finalized.</p>
        </Card>
      )}

      <Button type="submit" disabled={!profile.ready || !selectionComplete} loading={submitting} icon={CheckCircle2} className="w-full sm:w-auto">
        {submitting ? "Finalizing..." : finalizedPanel.length === roles.length ? "Update final panel" : "Finalize selected panel"}
      </Button>
    </form>
  );
}

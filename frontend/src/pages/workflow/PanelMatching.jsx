import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, CheckCircle2, AlertTriangle, UserX } from "lucide-react";
import { SectionTitle, StatusBadge } from "../../components/ui";
import { MiniBox } from "./shared";

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
  overload: "bg-amber-50 text-amber-800 ring-amber-200",
  unavailable: "bg-red-50 text-red-700 ring-red-200",
  no_overlap: "bg-slate-100 text-slate-600 ring-slate-200",
  thin_records: "bg-slate-100 text-slate-600 ring-slate-200",
};
const PANEL_COMPONENT_META = [
  { key: "expertise", label: "Expertise match", bar: "bg-brand-600", dot: "bg-brand-600" },
  { key: "availability", label: "Availability", bar: "bg-blue-500", dot: "bg-blue-500" },
  { key: "workload", label: "Workload", bar: "bg-amber-500", dot: "bg-amber-500" },
];

function PanelScoreBar({ components, total }) {
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Score ${total} of 100: ${PANEL_COMPONENT_META.map((item) => `${item.label} ${components?.[item.key]?.score ?? 0} of ${components?.[item.key]?.max ?? 0}`).join(", ")}`}>
        {PANEL_COMPONENT_META.map((item) => (
          <span key={item.key} className={`block h-full ${item.bar}`} style={{ width: `${Math.max(0, Math.min(100, components?.[item.key]?.score ?? 0))}%` }} />
        ))}
      </div>
      <p className="mt-1 whitespace-nowrap text-[10px] text-slate-500">
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
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">How the score was built</p>
        {PANEL_COMPONENT_META.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-slate-600"><i className={`h-2.5 w-2.5 rounded-sm ${item.dot}`} />{item.label}</span>
            <span className="font-semibold text-ink">{components[item.key]?.score ?? 0} / {components[item.key]?.max ?? 0}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2"><span className="font-semibold text-slate-600">Total</span><span className="font-bold text-ink">{candidate.score} / 100</span></div>
        <p className="text-slate-500">Expertise is scaled across the candidate pool, so the closest match gets full marks and others are proportional. {candidate.availability_windows} conflict-free defense windows; {candidate.workload} other student panel{candidate.workload === 1 ? "" : "s"}.</p>
        <p className="text-slate-500">Method: <span className="font-semibold text-slate-700">{methodLabel || candidate.method_label}</span>{breakdown.similarity !== undefined && <> (similarity {breakdown.similarity})</>}.</p>
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Why this faculty matches</p>
        <p className="leading-relaxed text-slate-700">{breakdown.reason || candidate.note}</p>
        {breakdown.matched_passage ? (
          <blockquote className="rounded-lg border-l-4 border-brand-300 bg-brand-50/60 px-3 py-2 leading-relaxed text-slate-700">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-700">Passage of the paper that matched</span>
            {breakdown.matched_passage}
          </blockquote>
        ) : <p className="text-slate-500">No passage of the paper overlaps with this faculty member's records.</p>}
        {breakdown.ai_rationale && <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><span className="font-semibold">Optional AI note:</span> {breakdown.ai_rationale}</p>}
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Expertise records used</p>
        {(breakdown.evidence || []).length ? breakdown.evidence.map((item, index) => (
          <div key={`${item.kind}-${index}`} className="rounded-lg border border-slate-100 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{item.kind_label}</span>
              {item.year && <span className="text-[10px] text-slate-400">{item.year}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.source === "demo seed" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{item.source === "demo seed" ? "Demo data" : item.source}</span>
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
      <SectionTitle title="Panel recommendation workspace" subtitle="Review why each faculty member ranks where they do, adjust the suggested panel, then finalize it" icon={Users} action={<Link to="/faculty" className="btn-ghost cursor-pointer"><Users className="h-4 w-4" /> Faculty profiles</Link>} />
      <div className={`rounded-xl border px-4 py-3 ${profile.ready ? "border-brand-200 bg-brand-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${profile.ready ? "text-brand-800" : "text-amber-900"}`}>
              {profile.ready ? `${sourceLabel} content ready` : profile.blocked_reason || `Readable ${sourceLabel} PDF text is required`}
            </p>
            <p className={`mt-1 text-xs ${profile.ready ? "text-brand-700" : "text-amber-800"}`}>
              {documentCount} of {requiredCount} PDFs uploaded. {readableCount} of {requiredCount} successfully read. Source: {profile.source || "No research evidence yet"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {methodLabel && <StatusBadge value={methodLabel} dot={false} />}
            <StatusBadge value={profile.ready ? "Ready" : "Blocked"} dot={false} />
          </div>
        </div>
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${profile.ready ? "border-brand-200 bg-white/80 text-brand-800" : "border-amber-200 bg-white/70 text-amber-900"}`}>
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
            {profile.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{keyword}</span>)}
          </div>
        )}
        {profile.concept_papers?.length > 0 && (
          <div className="mt-4 grid gap-2">
            {profile.concept_papers.slice(0, 3).map((paper) => (
              <div key={paper.id} className="rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={paper.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-brand-700">{paper.name}</a>
                  <StatusBadge value={paper.extracted ? "Text extracted" : "No readable text"} dot={false} />
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
        <MiniBox label="Expertise match (paper vs. faculty records)" value={`${weights.expertise} pts`} tone="brand" />
        <MiniBox label="Availability (conflict-free windows)" value={`${weights.availability} pts`} tone="blue" />
        <MiniBox label="Workload (other student panels)" value={`${weights.workload} pts`} tone="amber" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">{context.research_case_type || "Thesis"} panel needs {roles.length} members: {roles.join(", ")}. Expertise counts most; candidates who share no topic with the paper are listed after those who do.</p>
      </div>

      {excluded.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="note">
          <p className="flex items-center gap-2 font-semibold"><UserX className="h-4 w-4" /> Not eligible for this student's panel</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {excluded.map((item) => <li key={item.faculty_id}><span className="font-semibold">{item.faculty_name}</span>: {item.reason}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label><span className="field-label">Search faculty</span><input className="field-input" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Name, expertise, keyword, department" /></label>
        <label><span className="field-label">Specialization</span><input className="field-input" value={filters.specialization} onChange={(event) => setFilters((current) => ({ ...current, specialization: event.target.value }))} placeholder="e.g. analytics" /></label>
        <label><span className="field-label">Department / program</span><input className="field-input" value={filters.college} onChange={(event) => setFilters((current) => ({ ...current, college: event.target.value }))} placeholder="Search college" /></label>
        <label><span className="field-label">Availability</span><select className="field-input cursor-pointer" value={filters.availability} onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value }))}><option value="">All availability</option><option>Available</option><option>Limited availability</option><option>No availability recorded</option></select></label>
      </div>

      {profile.ready && recs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>{searchActive ? `Showing ${visibleRecommendations.length} matching faculty from ${recs.length} ranked candidates.` : `Showing the top ${Math.min(PANEL_MATCHING_DEFAULT_LIMIT, recs.length)} ranked candidates.`} The suggested panel is highlighted and preselected; open "Why" on any row to see the evidence.</span>
          {defaultLimited && <span className="font-medium text-brand-700">Use search or filters to find the other {recs.length - PANEL_MATCHING_DEFAULT_LIMIT} faculty.</span>}
        </div>
      )}

      {profile.ready && visibleRecommendations.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {searchActive ? "No faculty match the current search. Clear or broaden the filters to return to the top 15." : "No eligible faculty profiles were found. Add an active faculty profile with expertise records and availability data, then run matching again."}
        </div>
      )}

      {visibleRecommendations.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200">
        <div className="min-w-[980px] text-sm" role="table" aria-label="Ranked panel candidates">
          <div role="row" className="grid grid-cols-[minmax(230px,1.1fr)_minmax(260px,1.6fr)_minmax(190px,1fr)_minmax(170px,0.9fr)] border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
            <div role="columnheader" className="px-4 py-3">Rank / faculty</div>
            <div role="columnheader" className="px-3 py-3">Expertise match</div>
            <div role="columnheader" className="px-3 py-3">Availability &amp; workload</div>
            <div role="columnheader" className="px-3 py-3 text-right">Score breakdown</div>
          </div>
          <div role="rowgroup">
            {visibleRecommendations.map((r) => {
              const rank = rankByFacultyId.get(r.faculty_id);
              const isSuggested = suggestedIds.has(r.faculty_id);
              const isSelected = selectedIds.includes(r.faculty_id);
              const isOpen = expanded.has(r.faculty_id);
              const rowClass = isSuggested ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-200" : isSelected ? "bg-brand-50/50" : "bg-white";
              const flags = r.flags || [];
              const topics = r.breakdown?.matched_topics || r.matched_keywords || [];
              return (
                <div key={r.faculty_id} role="row" className={`border-b border-slate-100 align-top last:border-0 ${rowClass}`}>
                  <div role="cell">
                    <div className="grid grid-cols-[minmax(230px,1.1fr)_minmax(260px,1.6fr)_minmax(190px,1fr)_minmax(170px,0.9fr)] items-start">
                      <div className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isSuggested ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{rank}</span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link to={`/faculty?faculty=${r.faculty_id}`} className="font-semibold text-ink transition-colors hover:text-brand-700 hover:underline">{r.faculty_name}</Link>
                              {isSuggested && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Suggested: {suggestedRoleById.get(r.faculty_id)}</span>}
                              {isSelected && !isSuggested && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">Selected</span>}
                            </div>
                            <p className="text-xs text-slate-500">{r.college}</p>
                            {flags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{flags.map((flag) => <span key={flag.type} title={flag.message} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${PANEL_FLAG_TONES[flag.type] || PANEL_FLAG_TONES.thin_records}`}>{PANEL_FLAG_LABELS[flag.type] || flag.type}</span>)}</div>}
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-3 text-slate-600">
                        {topics.length > 0
                          ? <div className="flex flex-wrap gap-1">{topics.slice(0, 5).map((topic) => <span key={topic} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{topic}</span>)}</div>
                          : <p className="text-xs text-slate-500">No distinctive topic in common with the paper</p>}
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{r.specialization}</p>
                        <button type="button" onClick={() => toggleExpanded(r.faculty_id)} aria-expanded={isOpen} className="mt-1.5 cursor-pointer text-xs font-semibold text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-400">{isOpen ? "Hide why" : "Why this score"}</button>
                      </div>
                      <div className="px-3 py-3"><p className="font-medium text-slate-700">{r.availability_status}</p><p className="text-xs text-slate-400">{r.availability_windows} conflict-free windows</p><p className="mt-1 text-xs text-slate-500">{r.workload} other student panel{r.workload === 1 ? "" : "s"}</p></div>
                      <div className="px-3 py-3 text-right">
                        <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">{r.score}/100</span>
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
        <div className="flex flex-wrap gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500">
          {PANEL_COMPONENT_META.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm ${item.dot}`} />{item.label}</span>)}
        </div>
      </div>}

      {visibleRecommendations.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-sm font-semibold text-ink">Review and adjust the panel set</p><p className="mt-0.5 text-xs text-slate-500">The suggested panel is preselected: the strongest methods profile takes the Method seat and the rest follow by score. Staff may change any role before finalizing.</p></div>
          <StatusBadge value={finalizedPanel.length === roles.length ? "Final panel selected" : "Staff review"} dot={false} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role, index) => (
            <label key={role} className="block text-xs font-semibold text-slate-600">
              {role}
              <select value={selectedIds[index] || ""} onChange={(event) => selectFaculty(index, event.target.value)} className="mt-1.5 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                <option value="">Select faculty</option>
                {selectorOptions.map((item) => <option key={item.faculty_id} value={item.faculty_id}>#{rankByFacultyId.get(item.faculty_id)} {item.faculty_name} - {item.score}/100</option>)}
              </select>
            </label>
          ))}
        </div>
        {!selectionComplete && <p className="mt-3 text-xs font-medium text-amber-700">Choose a different eligible faculty member for every required role.</p>}
      </div>}

      {composition && visibleRecommendations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Panel composition rules</p>
            <StatusBadge value={composition.satisfied ? "Suggested panel satisfies the protocol" : "Protocol rule not satisfied"} dot={false} />
          </div>
          <ul className="space-y-1.5">
            {composition.checks.map((check) => (
              <li key={check.rule} className="flex items-start gap-2 text-xs">
                {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${check.severity === "required" ? "text-red-600" : "text-amber-600"}`} />}
                <span className={check.ok ? "text-slate-600" : check.severity === "required" ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>{check.message}{check.severity === "advisory" && !check.ok ? " (advisory)" : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">Source: {composition.source}. Checked again on the server when the panel is finalized.</p>
        </div>
      )}

      <button type="submit" disabled={submitting || !profile.ready || !selectionComplete} className="btn-primary w-full cursor-pointer sm:w-auto">
        <CheckCircle2 className="h-4 w-4" /> {submitting ? "Finalizing..." : finalizedPanel.length === roles.length ? "Update final panel" : "Finalize selected panel"}
      </button>
    </form>
  );
}

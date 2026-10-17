import { useState } from "react";
import { BookOpenCheck, BriefcaseBusiness, Clock3, ExternalLink, FileSearch, FileText, Gauge, Mail, Search } from "lucide-react";
import { api } from "../api";
import { Button, Modal, StatusChip } from "./ui/index.js";

export default function FacultyAssignmentProfile({ faculty, onClose }) {
  if (!faculty) return null;
  const preferred = faculty.preferred_subjects || [];
  const hours = (faculty.working_hours || []).filter((item) => item.enabled);
  const load = faculty.teaching_load_units || 0;
  const limit = faculty.teaching_load_limit || 24;
  const cv = faculty.cv_profile;
  const updatedDate = faculty.availability_updated_at ? new Date(faculty.availability_updated_at) : null;
  const updatedLabel = updatedDate && !Number.isNaN(updatedDate.getTime())
    ? updatedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [ragError, setRagError] = useState("");
  const [asking, setAsking] = useState(false);

  async function askCv(event, suggestedQuestion = "") {
    event?.preventDefault();
    const nextQuestion = (suggestedQuestion || question).trim();
    if (!nextQuestion) return;
    setQuestion(nextQuestion);
    setAsking(true);
    setRagError("");
    try {
      setAnswer(await api.facultyCvRag(faculty.id, nextQuestion));
    } catch (error) {
      setRagError(error.message || "Could not search the indexed CV.");
    } finally {
      setAsking(false);
    }
  }

  const initials = faculty.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "F";

  return (
    <Modal
      title={faculty.name}
      subtitle={faculty.college}
      icon={<span className="text-sm font-semibold">{initials}</span>}
      badge={<span className="eyebrow">Assignment reference</span>}
      size="lg"
      onClose={onClose}
      closeLabel="Close faculty profile"
    >
      {/* data-autofocus: the dialog opens at the top of its content, not on the first link far down the page */}
      <div className="space-y-5 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" tabIndex={-1} data-autofocus>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileFact icon={BriefcaseBusiness} label="Specialization">
            <p className="text-sm leading-relaxed text-slate-700">{faculty.specialization || "No specialization recorded."}</p>
          </ProfileFact>
          <ProfileFact icon={Gauge} label="Current teaching load">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{load}/{limit} units</p>
              <StatusChip status={load >= limit ? "At capacity" : `${Math.max(limit - load, 0)} units available`} dot={false} />
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, (load / limit) * 100)}%` }} />
            </div>
          </ProfileFact>
        </div>

        <ProfileFact icon={BookOpenCheck} label="Preferred subjects">
          {preferred.length ? (
            <div className="flex flex-wrap gap-2">
              {preferred.map((subject) => (
                <span key={subject.id} className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800">
                  {subject.code} · priority {subject.priority}
                </span>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">No preferred teaching subjects recorded.</p>}
        </ProfileFact>

        <ProfileFact icon={FileText} label="Reference basis">
          <p className="text-sm text-slate-700">{faculty.profile_source || "Faculty profile maintained by the Graduate School."}</p>
          <ul className="mt-2 grid gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
            {(faculty.profile_basis || []).map((item) => <li key={item} className="rounded-lg bg-slate-50 px-2.5 py-2">{item}</li>)}
          </ul>
        </ProfileFact>

        {cv && (
          <ProfileFact icon={FileSearch} label="CV reference assistant">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">Demonstration source.</span> {cv.disclaimer}
            </div>
            <div className="mt-3 flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{cv.document_title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{cv.summary}</p>
                </div>
                <Button as="a" variant="secondary" href={cv.source_url} target="_blank" rel="noreferrer" className="shrink-0 px-3 py-2">
                  View full sample CV <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="micro">{cv.indexed_chunk_count} indexed sections · {cv.source_label}</p>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-700">Ask the indexed CV</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(cv.suggested_questions || []).map((item) => (
                  <button key={item} type="button" onClick={(event) => askCv(event, item)} className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700">
                    {item}
                  </button>
                ))}
              </div>
              <form onSubmit={askCv} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor={`faculty-cv-question-${faculty.id}`} className="sr-only">Question about {faculty.name}'s indexed CV reference</label>
                <input id={`faculty-cv-question-${faculty.id}`} value={question} onChange={(event) => setQuestion(event.target.value)} className="field-input flex-1" placeholder="Example: What teaching evidence supports this subject?" maxLength={500} />
                <Button type="submit" icon={Search} disabled={asking || question.trim().length < 5} className="sm:self-start">
                  {asking ? "Searching…" : "Search CV"}
                </Button>
              </form>
              <div aria-live="polite">
                {ragError && <p className="mt-2 text-sm text-red-700">{ragError}</p>}
                {answer && (
                  <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                    <p className="eyebrow text-brand-700">Document-grounded answer</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{answer.answer}</p>
                    <div className="mt-3 space-y-2">
                      {(answer.citations || []).map((citation) => (
                        <a key={citation.section} href={citation.source_url} target="_blank" rel="noreferrer" className="block rounded-lg border border-brand-100 bg-white p-3 text-xs hover:border-brand-300">
                          <span className="font-semibold text-ink">{citation.section}</span>
                          <span className="mt-1 block leading-relaxed text-slate-600">{citation.excerpt}</span>
                          <span className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-700">{citation.source_label} <ExternalLink className="h-3 w-3" /></span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ProfileFact>
        )}

        <ProfileFact icon={Clock3} label="Availability">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusChip status={faculty.availability_status || (faculty.availability_entered ? "Entered" : "Not entered")} dot={false} />
            {faculty.availability_entered && updatedLabel && <span className="text-xs text-slate-500">updated {updatedLabel}</span>}
          </div>
          {hours.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {hours.map((item) => (
                <div key={item.weekday} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold text-ink">{item.day}</span> · {item.start}–{item.end}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {faculty.availability_entered
                ? "No weekly hours entered. Free dates may still be set in the faculty portal."
                : "Not entered - the faculty member enters it in their portal."}
            </p>
          )}
          {hours.length > 0 && <p className="meta mt-2">Philippine time.</p>}
        </ProfileFact>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="h-4 w-4 text-brand-600" />
            <span>{faculty.email || "No email recorded"}</span>
          </div>
          <p className="text-xs text-slate-500">The recommendation is advisory. The Academic Coordinator makes the final assignment.</p>
        </div>
      </div>
    </Modal>
  );
}

function ProfileFact({ icon: Icon, label, children }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></span>
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
      </div>
      {children}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Send, Sparkles, BookText, Info, Bot, User, CornerDownLeft } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle } from "../components/ui";
import StudentPicker from "../components/StudentPicker";

export default function Assistant() {
  const [searchParams] = useSearchParams();
  const initialStudentId = searchParams.get("student_id");
  const initialQuestion = searchParams.get("q") || "";
  const { data: meta } = useApi(() => api.meta(), []);
  const { data: suggData } = useApi(() => api.assistantSuggestions(), []);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi! I'm the Policy & Case Guidance assistant. Ask me about a student's status, what's pending, or Graduate School policy (LOA, panel, defense readiness, completion). I answer from live records and the GS policy library — and always show my sources.",
      citations: [],
    },
  ]);
  const [input, setInput] = useState(initialQuestion);
  const [studentId, setStudentId] = useState(initialStudentId ? Number(initialStudentId) : null);
  const [studentLabel, setStudentLabel] = useState(searchParams.get("student_label") || "");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const nextStudentId = searchParams.get("student_id");
    const nextQuestion = searchParams.get("q") || "";
    setStudentId(nextStudentId ? Number(nextStudentId) : null);
    setStudentLabel(searchParams.get("student_label") || "");
    if (nextQuestion) setInput(nextQuestion);
  }, [searchParams]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question) {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await api.assistant(q, studentId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: res.answer,
          citations: res.citations || [],
          grounded: res.grounded,
          recommendations: res.recommendations || [],
          structured: res.structured || null,
          source: res.source || null,
          student: res.student,
          mode: res.mode,
        },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `Sorry — ${err.message}`, citations: [], error: true }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = suggData?.items || [];

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Policy &amp; Case Guidance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask in plain language. Answers are grounded on live monitoring records and the Graduate School policy library,
          with sources shown. For guidance only — final decisions stay with authorized personnel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Chat */}
        <Card className="flex h-[600px] flex-col lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Bot className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Assistant</p>
              <p className="text-[11px] text-slate-400">
                {studentId ? `Focused on ${studentLabel.split(" - ")[1] || "a student"}` : "General · policy + all students"}
              </p>
            </div>
          </div>

          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
          >
            {messages.map((m, i) => (
              <Message key={i} m={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="flex gap-1">
                  <Dot /> <Dot /> <Dot />
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="border-t border-slate-100 p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                rows={1}
                placeholder="Ask about a student or a policy…"
                className="field-input max-h-32 flex-1 resize-none"
              />
              <button type="submit" disabled={busy || !input.trim()} className="btn-primary h-[46px] px-4">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-slate-400">
              <CornerDownLeft className="h-3 w-3" /> Enter to send · Shift+Enter for a new line
            </p>
          </form>
        </Card>

        {/* Side rail */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Focus on a student" subtitle="Optional — ground answers in one record" icon={User} />
            <StudentPicker
              value={studentId}
              selectedLabel={studentLabel}
              meta={meta}
              onChange={(id, label) => {
                setStudentId(id);
                setStudentLabel(label || "");
              }}
            />
          </Card>

          <Card className="p-5">
            <SectionTitle
              title="Example questions"
              subtitle="Shortcuts only — you can type any question"
              icon={Sparkles}
            />
            <div className="space-y-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  disabled={busy}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="How this works" icon={Info} />
            <p className="text-sm leading-relaxed text-slate-600">
              The assistant retrieves the relevant policy and the student's computed indicators first, then explains them
              — it never invents status. Every answer lists its sources. The backend stays the source of truth.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Message({ m }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[88%] space-y-2">
        {m.structured?.type === "student_attention" ? (
          <AttentionReport report={m.structured} />
        ) : m.structured?.type === "grounded_record" ? (
          <GroundedRecordReport report={m.structured} />
        ) : (
          <div className={`whitespace-pre-line rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed ${m.error ? "bg-red-50 text-red-700" : "bg-slate-50 text-ink"}`}>
            {m.text}
          </div>
        )}

        {m.source && (
          <div
            title={m.source.detail}
            aria-label={`Answer source: ${m.source.label}. ${m.source.detail}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            {m.source.ai_used ? <Sparkles className="h-3 w-3 text-brand-600" /> : <Info className="h-3 w-3 text-slate-500" />}
            {m.source.label}
          </div>
        )}

        {m.student && (
          <Link
            to={`/students/${m.student.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer"
          >
            <User className="h-3.5 w-3.5" /> {m.student.name} · {m.student.program_code}
          </Link>
        )}

        {m.citations && m.citations.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <BookText className="h-3.5 w-3.5" /> Sources
            </p>
            <div className="space-y-1.5">
              {m.citations.map((c) => (
                <details key={c.id} className="group rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                  <summary className="flex cursor-pointer items-center justify-between font-semibold text-slate-700">
                    <span>{c.title}</span>
                    <span className="text-[10px] font-medium text-slate-400">{c.source}</span>
                  </summary>
                  <p className="mt-1.5 leading-relaxed text-slate-500">{c.text}</p>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GroundedRecordReport({ report }) {
  const severityClass = {
    critical: "border-red-300 bg-red-50 text-red-800",
    high: "border-red-200 bg-red-50 text-red-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <section
      aria-label={report.heading}
      className="overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-ink">{report.heading}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{report.summary}</p>
      </div>

      {report.facts?.length > 0 && (
        <dl className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
          {report.facts.map((fact) => (
            <div key={fact.label} className="bg-white px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{fact.label}</dt>
              <dd className="mt-0.5 text-xs font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {report.findings?.length > 0 && (
        <ol className="divide-y divide-slate-100 border-t border-slate-100">
          {report.findings.map((finding, index) => (
            <li key={`${finding.code}-${index}`} className="px-4 py-3 text-xs leading-relaxed">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{index + 1}. {finding.title}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass[finding.severity] || severityClass.medium}`}>
                  {finding.severity}
                </span>
              </div>
              <p className="mt-1 text-slate-600">{finding.detail}</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                <span className="font-semibold text-ink">Next action:</span> {finding.action}
                <span className="mt-0.5 block text-slate-500">Owner: {finding.owner}</span>
              </p>
            </li>
          ))}
        </ol>
      )}

      {report.next_action && report.findings?.length === 0 && (
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-700">
          <span className="font-semibold text-ink">Next action:</span> {report.next_action}
          <span className="mt-0.5 block text-slate-500">Owner: {report.next_owner}</span>
        </div>
      )}
    </section>
  );
}

function AttentionReport({ report }) {
  const { summary, students } = report;
  const severityClass = {
    high: "border-red-200 bg-red-50 text-red-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <section
      aria-label="Students needing attention"
      className="overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-ink">Students needing attention</p>
        <p className="mt-0.5 text-xs text-slate-600">
          {summary.students} students · {summary.follow_ups} follow-up items · Showing {report.shown_students} highest priority
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Follow-up items by severity">
          {["high", "medium", "low"].map((level) => summary[level] > 0 && (
            <span
              key={level}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${severityClass[level]}`}
            >
              {summary[level]} {level}
            </span>
          ))}
        </div>
      </div>

      <ol className="divide-y divide-slate-100">
        {students.map((student, index) => (
          <li key={student.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/students/${student.id}`}
                  className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                >
                  {index + 1}. {student.name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {student.program_code} · {student.stage} · {student.student_number}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass[student.severity]}`}>
                {student.severity}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {student.issues.map((issue, issueIndex) => (
                <div
                  key={`${student.id}-${issueIndex}`}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
                >
                  <p><span className="font-semibold text-ink">Issue:</span> {issue.trigger}</p>
                  <p className="mt-1"><span className="font-semibold text-ink">Next action:</span> {issue.recommendation}</p>
                  <p className="mt-1 text-slate-500"><span className="font-semibold text-slate-700">Owner:</span> {issue.owner}</p>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: "0ms" }} />;
}

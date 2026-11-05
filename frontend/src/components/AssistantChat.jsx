import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, UserRound } from "lucide-react";
import { Button, Card, InlineNotice, StatusChip, Textarea } from "./ui/index.js";
import { AnswerBadge, NotCoveredNotice, SourceList } from "./AssistantSources";

const MAX_QUESTION_LENGTH = 1500;

/**
 * The Policy Assistant chat used by every role: a message list, the answer's label and sources under each answer,
 * suggested questions and the question box.
 *
 * @param ask          async (question) => the /api/assistant reply
 * @param greeting     the first assistant message
 * @param suggestions  3 or 4 starter questions (one should be personal)
 * @param scope        short line under the chat title ("Policy documents only")
 * @param initialQuestion  text to put in the box (from a link such as ?q=...)
 * @param linkStudent  show a link to the student record an answer was about (staff only)
 */
export default function AssistantChat({ ask, greeting, suggestions = [], scope, initialQuestion = "", linkStudent = false }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: greeting, intro: true }]);
  const [input, setInput] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    // scroll the message list itself, never the page
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await ask(q);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, reply: res }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: err.message || "The assistant could not answer right now. Try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card pad="none" className="flex min-h-[28rem] flex-col overflow-hidden lg:h-[40rem]" data-testid="assistant-chat">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="card-title">Assistant</h2>
          {scope && <p className="meta">{scope}</p>}
        </div>
      </div>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation" className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.map((m, i) => (
          <Message key={i} m={m} linkStudent={linkStudent} />
        ))}
        {busy && (
          <div role="status" className="flex items-center gap-2.5 text-sm text-slate-500">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
            Looking through the policy documents…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="space-y-2 border-t border-slate-100 p-3 sm:p-4"
      >
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Suggested questions" role="group">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={busy}
                className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="Ask a question, or tap one above"
            aria-label="Your question"
            className="max-h-32 min-w-0 flex-1 resize-none"
          />
          <Button type="submit" icon={Send} loading={busy} disabled={!input.trim()} aria-label="Send question" className="shrink-0" />
        </div>
        <p className="meta">Enter to send · Shift+Enter for a new line</p>
      </form>
    </Card>
  );
}

function Message({ m, linkStudent }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white">{m.text}</div>
      </div>
    );
  }
  const reply = m.reply;
  return (
    <div className="flex gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Bot className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 max-w-[92%] flex-1 space-y-2">
        {m.error ? (
          <InlineNotice tone="danger">{m.text}</InlineNotice>
        ) : reply?.not_covered ? (
          <NotCoveredNotice answer={m.text} />
        ) : reply?.structured?.type === "student_attention" ? (
          <AttentionReport report={reply.structured} />
        ) : reply?.structured?.type === "grounded_record" ? (
          <GroundedRecordReport report={reply.structured} />
        ) : (
          <div className="whitespace-pre-line break-words rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-2.5 text-sm leading-relaxed text-slate-800">{m.text}</div>
        )}

        {reply && !reply.not_covered && <AnswerBadge source={reply.source} personal={Boolean(reply.personal)} />}

        {linkStudent && reply?.student && (
          <Link
            to={`/students/${reply.student.id}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 sm:min-h-0"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> {reply.student.name} · {reply.student.program_code}
          </Link>
        )}

        <SourceList citations={reply?.sources ?? reply?.citations} />
      </div>
    </div>
  );
}

const SEVERITY_TONE = { critical: "danger", high: "danger", medium: "warning", low: "info" };

function GroundedRecordReport({ report }) {
  return (
    <section aria-label={report.heading} className="overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="card-title">{report.heading}</p>
        <p className="meta mt-1">{report.summary}</p>
      </div>

      {report.facts?.length > 0 && (
        <dl className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
          {report.facts.map((fact) => (
            <div key={fact.label} className="bg-white px-4 py-2.5">
              <dt className="eyebrow">{fact.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {report.findings?.length > 0 && (
        <ol className="divide-y divide-slate-100 border-t border-slate-100">
          {report.findings.map((finding, index) => (
            <li key={`${finding.code}-${index}`} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-800">{index + 1}. {finding.title}</p>
                <StatusChip status={finding.severity} tone={SEVERITY_TONE[finding.severity] || "warning"} dot={false} size="sm" />
              </div>
              <p className="mt-1 text-slate-600">{finding.detail}</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                <span className="font-semibold text-slate-800">Next action:</span> {finding.action}
                <span className="meta mt-0.5 block">Owner: {finding.owner}</span>
              </p>
            </li>
          ))}
        </ol>
      )}

      {report.next_action && report.findings?.length === 0 && (
        <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-800">Next action:</span> {report.next_action}
          <span className="meta mt-0.5 block">Owner: {report.next_owner}</span>
        </div>
      )}
    </section>
  );
}

function AttentionReport({ report }) {
  const { summary, students } = report;
  return (
    <section aria-label="Students needing attention" className="overflow-hidden rounded-2xl rounded-tl-sm border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="card-title">Students needing attention</p>
        <p className="meta mt-0.5">
          {summary.students} students · {summary.follow_ups} follow-up items · Showing {report.shown_students} highest priority
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Follow-up items by severity">
          {["high", "medium", "low"].map(
            (level) =>
              summary[level] > 0 && (
                <StatusChip key={level} status={`${summary[level]} ${level}`} tone={SEVERITY_TONE[level]} dot={false} size="sm" />
              ),
          )}
        </div>
      </div>

      <ol className="divide-y divide-slate-100">
        {students.map((student, index) => (
          <li key={student.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/students/${student.id}`} className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                  {index + 1}. {student.name}
                </Link>
                <p className="meta mt-0.5">
                  {student.program_code} · {student.stage} · {student.student_number}
                </p>
              </div>
              <StatusChip status={student.severity} tone={SEVERITY_TONE[student.severity] || "warning"} dot={false} size="sm" />
            </div>
            <div className="mt-2 space-y-2">
              {student.issues.map((issue, issueIndex) => (
                <div key={`${student.id}-${issueIndex}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-800">Issue:</span> {issue.trigger}</p>
                  <p className="mt-1"><span className="font-semibold text-slate-800">Next action:</span> {issue.recommendation}</p>
                  <p className="meta mt-1"><span className="font-semibold text-slate-700">Owner:</span> {issue.owner}</p>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

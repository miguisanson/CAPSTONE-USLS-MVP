import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { api } from "../../api";
import { Card, EmptyState, ErrorNote, SectionTitle, StatusBadge } from "../../components/ui";
import { Field, Select, Textarea } from "../../components/forms";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { STUDENT_REQUEST_VIEW_BY_SLUG } from "./shared";

export function StudentInbox({ data, onSaved, onOpenRequest }) {
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const allMessages = [...(data.workflow_messages || [])].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
  const supportedMessagingWorkflows = ["leave-of-absence", "readmission", "awol", "practicum", "withdrawal", "graduation"];
  const activeWorkflowSet = new Set([
    data.practicum_record && "practicum",
    data.withdrawal_application && "withdrawal",
    data.graduation_endorsement && "graduation",
    data.awol_case && "awol",
    ...(data.logs || []).map((item) => item.transaction_slug),
    ...allMessages.map((item) => item.transaction_slug),
  ].filter(Boolean));
  const activeWorkflows = supportedMessagingWorkflows.filter((slug) => activeWorkflowSet.has(slug));
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [composeWorkflow, setComposeWorkflow] = useState(activeWorkflows[0] || "");
  const [composeRecipient, setComposeRecipient] = useState("Graduate School Staff");
  const [question, setQuestion] = useState("");
  const [questionBusy, setQuestionBusy] = useState(false);
  const messages = workflowFilter === "all"
    ? allMessages
    : allMessages.filter((message) => message.transaction_slug === workflowFilter);
  const threads = useMemo(() => {
    const grouped = new Map();
    messages.forEach((message) => {
      const key = message.thread_key || `${message.transaction_slug}:${message.request_id || data.student.id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(message);
    });
    return [...grouped.entries()]
      .map(([key, items]) => ({
        key,
        items,
        latestAt: items[items.length - 1]?.created_at,
        unread: items.filter((item) => item.is_unread).length,
      }))
      .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
  }, [messages, data.student.id]);
  const currentOwner = (data.logs || []).find((log) => log.transaction_slug === composeWorkflow)?.next_owner;
  const recipientOptions = [...new Set([
    "Graduate School Staff",
    currentOwner && currentOwner !== "Student" ? currentOwner : null,
  ].filter(Boolean))];

  useEffect(() => {
    if (!activeWorkflows.includes(composeWorkflow)) setComposeWorkflow(activeWorkflows[0] || "");
  }, [activeWorkflows.join("|"), composeWorkflow]);

  useEffect(() => {
    if (!recipientOptions.includes(composeRecipient)) setComposeRecipient(recipientOptions[0] || "Graduate School Staff");
  }, [composeWorkflow, currentOwner]);

  useEffect(() => {
    const unreadIds = messages.filter((message) => message.is_unread).map((message) => message.id);
    if (!unreadIds.length) return;
    let active = true;
    api.markWorkflowMessagesRead(unreadIds)
      .then(() => {
        if (active) onSaved();
      })
      .catch(() => {
        // Reading a thread must never block the Inbox itself.
      });
    return () => {
      active = false;
    };
  }, [messages.map((message) => `${message.id}:${message.is_unread}`).join("|")]);

  function requestLabel(slug) {
    const labels = {
      "leave-of-absence": "Leave of Absence",
      readmission: "Readmission",
      "course-audit": "Course Audit / Grades",
      awol: "AWOL / Residency",
      practicum: "Practicum",
      withdrawal: "Withdrawal",
      graduation: "Graduation",
    };
    return labels[slug] || slug || "Request";
  }

  function canReply(message) {
    return message.recipient_role === "Student" && message.sender_role !== "Student";
  }

  async function sendReply(message, key) {
    const comment = (drafts[key] || "").trim();
    if (!comment) return;
    setBusyId(key);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(message.transaction_slug, {
        action_type: "response",
        recipient_role: message.sender_role || "Graduate School Staff",
        template: "Remarks",
        comment,
        reply_to_message_id: message.id,
      });
      setDrafts((current) => ({ ...current, [key]: "" }));
      setNotice(result.message || "Reply sent.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your reply.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendQuestion(event) {
    event.preventDefault();
    if (!composeWorkflow || !question.trim()) return;
    setQuestionBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(composeWorkflow, {
        action_type: "note",
        recipient_role: composeRecipient,
        template: "Remarks",
        comment: question.trim(),
      });
      setQuestion("");
      setNotice(result.message || "Question sent.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your question.");
    } finally {
      setQuestionBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <SectionTitle title="Inbox / Messages" subtitle="Clarifications and staff replies for your requests" icon={Mail} />
      <ErrorNote message={error} />
      {notice && <p aria-live="polite" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}
      {activeWorkflows.length > 0 && (
        <form onSubmit={sendQuestion} className="mb-5 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Ask about an active request</p>
              <p className="mt-1 text-xs text-slate-500">Your question is saved in the request thread and routed to the current reviewer when available.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Workflow">
                  <Select value={composeWorkflow} onChange={(event) => setComposeWorkflow(event.target.value)} placeholder="" options={activeWorkflows.map((slug) => ({ value: slug, label: requestLabel(slug) }))} />
                </Field>
                <Field label="Recipient">
                  <Select value={composeRecipient} onChange={(event) => setComposeRecipient(event.target.value)} placeholder="" options={recipientOptions} />
                </Field>
              </div>
              <Field label="Question or clarification">
                <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Write your question about this request." />
              </Field>
              <button type="submit" disabled={questionBusy || !question.trim()} className="btn-primary mt-3 cursor-pointer">
                <Send className="h-4 w-4" /> {questionBusy ? "Sending..." : "Send question"}
              </button>
            </div>
          </div>
        </form>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600" htmlFor="student-inbox-workflow-filter">Filter messages</label>
        <select id="student-inbox-workflow-filter" value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className="field-input w-auto min-w-44 cursor-pointer">
          <option value="all">All workflows</option>
          <option value="leave-of-absence">Leave of Absence</option>
          <option value="readmission">Readmission</option>
          <option value="course-audit">Course Audit / Grades</option>
          <option value="awol">AWOL / Residency</option>
          <option value="practicum">Practicum</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="graduation">Graduation</option>
        </select>
      </div>
      {!threads.length ? (
        <EmptyState icon={Mail} title="No messages in this view" hint="Clarification requests, sent questions, and staff replies will appear here." />
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const first = thread.items[0];
            const latest = thread.items[thread.items.length - 1];
            const targetView = STUDENT_REQUEST_VIEW_BY_SLUG[first.transaction_slug];
            return (
              <section key={thread.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <MessageSquare className="h-4 w-4 text-brand-700" />
                        {requestLabel(first.transaction_slug)} request #{first.request_id || "current"}
                      </span>
                      <StatusBadge value={`${thread.items.length} message${thread.items.length === 1 ? "" : "s"}`} dot={false} />
                      {thread.unread > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">{thread.unread} unread</span>}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">Chronological request thread · current stage {latest.stage || latest.new_status || "not recorded"}</p>
                  </div>
                  {targetView && (
                    <button type="button" onClick={() => onOpenRequest(targetView)} className="btn-secondary shrink-0 cursor-pointer">
                      Open request <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <WorkflowDiscussion
                    messages={thread.items}
                    embedded
                    showHeader={false}
                    title={`${requestLabel(first.transaction_slug)} discussion`}
                    highlightLatest
                    renderMessageFooter={(message, key) => canReply(message) ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <label className="text-xs font-semibold text-slate-600" htmlFor={`student-inbox-reply-${key}`}>Reply to {message.sender_name || message.sender_role || "staff"}</label>
                        <textarea id={`student-inbox-reply-${key}`} value={drafts[key] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} className="field-input mt-1 min-h-24" placeholder="Explain what you updated or ask a follow-up question." />
                        <button type="button" disabled={busyId === key || !(drafts[key] || "").trim()} onClick={() => sendReply(message, key)} className="btn-primary mt-3 cursor-pointer">
                          <Send className="h-4 w-4" /> {busyId === key ? "Sending..." : "Send reply"}
                        </button>
                      </div>
                    ) : null}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

import { useId, useState } from "react";
import { CornerUpLeft, MessageSquarePlus } from "lucide-react";
import { api } from "../../api";
import { ErrorNote } from "../../components/ui";
import { Field, Select, Textarea } from "../../components/forms";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { Banner, Block } from "./leaveUi";

const NOTE_RECIPIENTS = [
  { value: "Student", label: "The student (they can read it)" },
  { value: "Dean", label: "The Dean (staff only)" },
  { value: "Graduate School Staff", label: "Graduate School staff (internal note)" },
];

// A plain note never changes where the request is.
function NoteForm({ slug, detail, onSent }) {
  const fieldId = useId();
  const [recipient, setRecipient] = useState("Graduate School Staff");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!comment.trim()) {
      setError("Write the note first.");
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    try {
      await api.sendWorkflowMessage(slug, {
        student_id: detail.student.id,
        action_type: "note",
        recipient_role: recipient,
        template: "Remarks",
        comment: comment.trim(),
        visibility: recipient === "Student" ? "student_visible" : "internal",
      });
      setComment("");
      setDone("Note saved. It does not move the request.");
      await onSent();
    } catch (err) {
      setError(err.message || "The note could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3" aria-labelledby={`${fieldId}-title`}>
      <h4 id={`${fieldId}-title`} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <MessageSquarePlus className="h-4 w-4 text-brand-700" aria-hidden="true" /> Write a note
      </h4>
      <Field label="Who is it for?">
        <Select value={recipient} onChange={(event) => setRecipient(event.target.value)} options={NOTE_RECIPIENTS} placeholder={null} />
      </Field>
      <Field label="Note">
        <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
      </Field>
      <ErrorNote message={error} />
      {done && <Banner tone="success">{done}</Banner>}
      <button type="submit" disabled={busy} className="btn-ghost px-4 py-2">
        {busy ? "Saving..." : "Save note"}
      </button>
    </form>
  );
}

// Sends the request back through the same guarded step as the "Return to student" button.
function ReturnForm({ detail, action, onTransition }) {
  const fieldId = useId();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!comment.trim()) {
      setError("Tell the student what to fix. A reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onTransition(detail, { action: action.action, comment: comment.trim() });
      setComment("");
    } catch (err) {
      setError(err.message || "The request could not be returned.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3" aria-labelledby={`${fieldId}-title`}>
      <h4 id={`${fieldId}-title`} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CornerUpLeft className="h-4 w-4 text-amber-700" aria-hidden="true" /> {action.label}
      </h4>
      <Field label="What should the student fix? (the student will see this)" required>
        <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
      </Field>
      <ErrorNote message={error} />
      <button
        type="submit"
        disabled={busy}
        className="btn bg-amber-100 px-4 py-2 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-200"
      >
        {busy ? "Sending..." : action.label}
      </button>
    </form>
  );
}

export default function CaseConversation({ slug, detail, onTransition, onNoteSent }) {
  const returnAction = (detail.actions || []).find((action) => action.action === "return");
  return (
    <Block title="Messages" hint="Notes and returns about this request, newest at the bottom.">
      <WorkflowDiscussion
        messages={detail.messages || []}
        embedded
        showHeader={false}
        title="Messages about this request"
        emptyText="No messages yet."
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <NoteForm slug={slug} detail={detail} onSent={onNoteSent} />
        {returnAction && <ReturnForm detail={detail} action={returnAction} onTransition={onTransition} />}
      </div>
    </Block>
  );
}

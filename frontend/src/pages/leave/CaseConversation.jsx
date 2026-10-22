import { useId, useState } from "react";
import { CornerUpLeft, MessageSquarePlus } from "lucide-react";
import { api } from "../../api";
import { Button, DecisionPanel, Field, InlineNotice, Select, Textarea } from "../../components/ui/index.js";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { Block } from "./leaveUi";

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
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!comment.trim()) {
      setFieldError("Write the note first.");
      return;
    }
    setBusy(true);
    setFieldError("");
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
      <Field label="Note" error={fieldError}>
        <Textarea
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            if (fieldError) setFieldError("");
          }}
          rows={3}
        />
      </Field>
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {done && <InlineNotice tone="success" icon>{done}</InlineNotice>}
      <Button type="submit" variant="secondary" loading={busy}>
        {busy ? "Saving..." : "Save note"}
      </Button>
    </form>
  );
}

// Sends the request back through the same guarded step as the "Return to student" button.
function ReturnForm({ detail, action, onTransition }) {
  async function send(_key, comment) {
    try {
      await onTransition(detail, { action: action.action, comment });
    } catch (err) {
      throw new Error(err?.message || "The request could not be returned.");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CornerUpLeft className="h-4 w-4 text-amber-700" aria-hidden="true" /> {action.label}
      </h4>
      <DecisionPanel
        variant="plain"
        actions={[{ key: action.action, label: action.label, tone: "return", requireComment: true, confirm: false }]}
        onDecide={send}
        commentLabel="What should the student fix? (the student will see this)"
        commentHint="Required for this step."
        commentRequiredMessage="Tell the student what to fix. A reason is required."
      />
    </div>
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

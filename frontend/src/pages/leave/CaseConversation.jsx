import { useId, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { api } from "../../api";
import { Button, Field, InlineNotice, Select, Textarea } from "../../components/ui/index.js";
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
        {busy ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}

// Returning a request to the student is the "Return to student" step in the case window's footer, which opens the one
// step dialog (StepDialog); this block only holds the conversation and the note box (I-152).
export default function CaseConversation({ slug, detail, onNoteSent, onEdited }) {
  return (
    <Block title="Messages" hint="Notes and returns about this request, newest at the bottom.">
      <WorkflowDiscussion
        messages={detail.messages || []}
        embedded
        showHeader={false}
        title="Messages about this request"
        emptyText="No messages yet."
        onEdited={onEdited}
      />
      <div className="mt-4">
        <NoteForm slug={slug} detail={detail} onSent={onNoteSent} />
      </div>
    </Block>
  );
}

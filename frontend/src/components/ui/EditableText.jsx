// EditableText, EditButton, EditedChip, EditHistoryDialog: the one way to correct something somebody typed, with a history
// (owner request 2026-11-04). The server decides who may edit (`edit.can`) and whether a reason is needed
// (`edit.reason_required`); every payload that holds editable text carries an `edit` reference:
//   { entity, id, field, label, can, reason_required, multiline, count, last_at, options? }
//
//   <EditableText edit={message.edit} value={message.comment} onSaved={reload} />
//
// It shows the text, an "Edited" chip that opens the change history (old -> new, who, when, why) and, when the signed-in
// person may edit it, an Edit button that opens a small window with the new value and the reason.
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { api } from "../../api";
import { formatDateTime } from "../../lib/format";
import { Button } from "./Button.jsx";
import { EmptyState, InlineNotice, Spinner } from "./Feedback.jsx";
import { Field, Input, Select, Textarea } from "./Field.jsx";
import { Modal } from "./Modal.jsx";

function EditDialog({ edit, value, onClose, onSaved }) {
  const [text, setText] = useState(value || "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needReason = edit.reason_required;
  const changed = text.trim() !== String(value || "").trim();
  const canSave = !busy && changed && (!needReason || reason.trim().length >= 3);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await api.editRecord(edit.entity, edit.id, { field: edit.field, value: text, reason: reason.trim() });
      onSaved(text.trim(), response);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit ${String(edit.label || "text").toLowerCase()}`}
      size="sm"
      onClose={onClose}
      dismissible={!busy}
      closeLabel="Close"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={!canSave} onClick={save}>{busy ? "Saving…" : "Save change"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={edit.label || "New text"} required>
          {edit.options ? (
            <Select data-autofocus="" options={edit.options} value={text} onChange={(event) => setText(event.target.value)} />
          ) : edit.multiline === false ? (
            <Input data-autofocus="" value={text} maxLength={220} onChange={(event) => setText(event.target.value)} />
          ) : (
            <Textarea data-autofocus="" className="min-h-28 resize-y" rows={5} value={text} onChange={(event) => setText(event.target.value)} />
          )}
        </Field>
        <Field
          label="Reason for the change"
          required={needReason}
          hint={needReason ? "Kept in the change history with your name and the time." : "Optional while the message is new. Kept in the change history."}
        >
          <Textarea
            className="min-h-16 resize-y"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: fixed a typo"
          />
        </Field>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </div>
    </Modal>
  );
}

export function EditHistoryDialog({ edit, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api.editHistory(edit.entity, edit.id)
      .then((body) => live && setItems((body.items || []).filter((item) => item.field === edit.field)))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [edit.entity, edit.id, edit.field]);

  return (
    <Modal title={`Change history: ${String(edit.label || "text").toLowerCase()}`} size="md" onClose={onClose} closeLabel="Close"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {!items && !error && <Spinner label="Loading the history…" />}
      {items && !items.length && <EmptyState size="sm" title="Nothing has been changed." />}
      {items && items.length > 0 && (
        <ol className="space-y-3" aria-label="Changes, newest first">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-ink">{item.actor_name || "Someone"}</span>
                {" · "}
                <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Before</p>
              <p className="whitespace-pre-wrap break-words text-slate-500 line-through">{item.old_value || "(empty)"}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">After</p>
              <p className="whitespace-pre-wrap break-words text-slate-800">{item.new_value || "(empty)"}</p>
              {item.reason && <p className="mt-2 text-xs text-slate-600">Reason: {item.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

/** The text with its Edited chip and Edit button. `children` can replace the plain text (it receives the current value). */
export function EditableText({ edit, value, onSaved, className = "", empty = "None", children }) {
  const [shown, setShown] = useState(null);
  const [count, setCount] = useState(null);
  const [open, setOpen] = useState(null); // "edit" | "history"
  const current = shown ?? value;
  const edits = count ?? edit?.count ?? 0;
  const text = children ? children(current) : (
    <p className={`whitespace-pre-wrap break-words ${className}`}>{current || <span className="text-slate-400">{empty}</span>}</p>
  );
  if (!edit || (!edit.can && !edits)) return text;
  return (
    <div className="min-w-0">
      {text}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {edits > 0 && (
          <button
            type="button"
            onClick={() => setOpen("history")}
            data-edit-chip=""
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-200"
            aria-label={`Edited ${edits} time${edits === 1 ? "" : "s"}. Open the change history`}
          >
            Edited{edits > 1 ? ` (${edits})` : ""}
          </button>
        )}
        {edit.can && (
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setOpen("edit")} data-edit-button="">
            Edit
          </Button>
        )}
      </div>
      {open === "edit" && (
        <EditDialog
          edit={edit}
          value={current}
          onClose={() => setOpen(null)}
          onSaved={(next, response) => {
            setShown(next);
            setCount((edits || 0) + 1);
            setOpen(null);
            onSaved?.(next, response);
          }}
        />
      )}
      {open === "history" && <EditHistoryDialog edit={edit} onClose={() => setOpen(null)} />}
    </div>
  );
}

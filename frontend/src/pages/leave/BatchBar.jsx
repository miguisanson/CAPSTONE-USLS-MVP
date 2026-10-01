import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Field, Input, Textarea } from "../../components/forms";
import { Banner } from "./leaveUi";
import { defaultBatchName, plural } from "./leaveHelpers";

const BUTTON_STYLES = {
  primary: "btn-primary",
  danger: "btn bg-red-600 text-white hover:bg-red-700",
  warn: "btn bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-200",
  secondary: "btn-ghost",
};

/**
 * The group step, the same in all four processes: tick cards, then apply one step to all of
 * them. `actions` are the steps every ticked request shares (the server marks them `batch`).
 * `onSubmit(action, { batchName, comment })` calls the batch route; the parent shows the
 * result with <BatchResult/>. A step that needs a reason asks for it once for the whole group.
 * Leave and Readmission also keep a batch name on each request so the Dean sees them as a group.
 */
export default function BatchBar({ selectedItems, slug, actions, nameBatches = false, onClear, onSubmit }) {
  const firstItem = selectedItems[0] || null;
  const firstId = firstItem?.id ?? null;
  const [name, setName] = useState(() => defaultBatchName(firstItem, slug));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const edited = useRef(false);
  const needsReason = actions.some((action) => action.needs_comment);
  const forwarding = nameBatches && actions.some((action) => action.action === "forward");

  // Keep the suggested name in step with the first selected request until staff edit it.
  useEffect(() => {
    if (!edited.current) setName(defaultBatchName(firstItem, slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId, slug]);

  async function run(action) {
    if (busy) return;
    if (action.needs_comment && !comment.trim()) {
      setError(`Write the reason first: "${action.label}" needs one.`);
      return;
    }
    setError("");
    setBusy(action.action);
    try {
      await onSubmit(action, { batchName: forwarding && action.action === "forward" ? name.trim() : "", comment: comment.trim() });
      edited.current = false;
      setComment("");
    } finally {
      setBusy("");
    }
  }

  if (!actions.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <p>The {plural(selectedItems.length, "ticked request")} do not share a group step. Tick requests in the same column.</p>
        <button type="button" onClick={onClear} className="btn-ghost px-4 py-2">Clear selection</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4" role="group" aria-label="Apply a step to the selected requests">
      <div className="flex flex-wrap items-end gap-3">
        {forwarding && (
          <div className="min-w-[14rem] flex-1">
            <Field label="Batch name" hint="This name is kept on each request so the Dean can see them as one group.">
              <Input
                value={name}
                onChange={(event) => {
                  edited.current = true;
                  setName(event.target.value);
                }}
                maxLength={120}
              />
            </Field>
          </div>
        )}
        {needsReason && (
          <div className="min-w-[14rem] flex-1">
            <Field label="Reason (for a return or a denial)" hint="Saved on every request in the group.">
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} />
            </Field>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          {actions.map((action) => (
            <button
              key={action.action}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => run(action)}
              className={`${BUTTON_STYLES[action.tone] || BUTTON_STYLES.primary} px-4 py-2.5`}
            >
              {action.action === "forward" && <Send className="h-4 w-4" />}
              {busy === action.action ? "Working..." : `${action.label} (${selectedItems.length})`}
            </button>
          ))}
          <button type="button" onClick={onClear} disabled={Boolean(busy)} className="btn-ghost px-4 py-2.5">
            Clear selection
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function BatchResult({ result, onDismiss }) {
  if (!result) return null;
  const skipped = result.skipped || [];
  return (
    <Banner tone={result.updated?.length ? "success" : "error"} onDismiss={onDismiss}>
      <p>{result.message}</p>
      {skipped.length > 0 && (
        <div className="mt-2 font-normal">
          <p className="font-semibold">Skipped:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {skipped.map((row) => (
              <li key={row.case_id}>
                {row.student_name || `Request ${row.case_id}`} - {row.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Banner>
  );
}

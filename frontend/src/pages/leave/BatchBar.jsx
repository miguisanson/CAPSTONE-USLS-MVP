import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button, Field, InlineNotice, Input, Textarea } from "../../components/ui/index.js";
import { defaultBatchName, plural } from "./leaveHelpers";

// The server's tone for a step -> a Button look ("warn" is the secondary look, like every return button in the app).
const VARIANT = { primary: "primary", danger: "danger", warn: "secondary", secondary: "secondary" };

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
      <InlineNotice tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-3 font-normal">
          <p>The {plural(selectedItems.length, "ticked request")} do not share a group step. Tick requests in the same column.</p>
          <Button variant="secondary" onClick={onClear}>Clear selection</Button>
        </div>
      </InlineNotice>
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
            <Button
              key={action.action}
              variant={VARIANT[action.tone] || "primary"}
              icon={action.action === "forward" ? Send : undefined}
              loading={busy === action.action}
              disabled={Boolean(busy)}
              onClick={() => run(action)}
            >
              {`${action.label} (${selectedItems.length})`}
            </Button>
          ))}
          <Button variant="secondary" onClick={onClear} disabled={Boolean(busy)}>
            Clear selection
          </Button>
        </div>
      </div>
      {error && <InlineNotice tone="danger" className="mt-2">{error}</InlineNotice>}
    </div>
  );
}

export function BatchResult({ result, onDismiss }) {
  if (!result) return null;
  const skipped = result.skipped || [];
  return (
    <InlineNotice tone={result.updated?.length ? "success" : "danger"} icon onDismiss={onDismiss}>
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
    </InlineNotice>
  );
}

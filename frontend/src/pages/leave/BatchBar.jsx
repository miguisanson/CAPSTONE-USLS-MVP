import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Field, Input } from "../../components/forms";
import { Banner } from "./leaveUi";
import { defaultBatchName, plural } from "./leaveHelpers";

/**
 * "Forward selected to the Dean" with a batch name. `onSubmit(batchName)` calls
 * api.leaveCasesBatch; the parent shows the result with <BatchResult/>.
 */
export default function BatchBar({ selectedItems, slug, onClear, onSubmit }) {
  const firstItem = selectedItems[0] || null;
  const firstId = firstItem?.id ?? null;
  const [name, setName] = useState(() => defaultBatchName(firstItem, slug));
  const [busy, setBusy] = useState(false);
  const edited = useRef(false);

  // Keep the suggested name in step with the first selected request until staff edit it.
  useEffect(() => {
    if (!edited.current) setName(defaultBatchName(firstItem, slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId, slug]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
      edited.current = false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-brand-200 bg-brand-50/60 p-4" aria-label="Forward selected requests">
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          <button type="submit" disabled={busy} className="btn-primary px-4 py-2.5">
            <Send className="h-4 w-4" />
            {busy ? "Forwarding..." : `Forward ${plural(selectedItems.length, "selected request")} to the Dean`}
          </button>
          <button type="button" onClick={onClear} disabled={busy} className="btn-ghost px-4 py-2.5">
            Clear selection
          </button>
        </div>
      </div>
    </form>
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

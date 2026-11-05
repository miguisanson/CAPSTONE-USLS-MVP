import { CheckCircle2, Clock3, Mail } from "lucide-react";
import { Button, Modal } from "./ui/index.js";

// Shown after an export is downloaded: what the file is and the two steps that happen outside the portal.
// The dialog shell (focus, Tab trap, Escape, backdrop, scroll lock, focus return) is the library Modal.
// `id` is accepted for the existing callers; the Modal makes its own label ids.
export default function ExportFollowUpModal({
  title,
  filename,
  actorLabel,
  fileLabel,
  onClose,
}) {
  return (
    <Modal
      title={title}
      subtitle="The file was downloaded successfully. No email was sent by the portal."
      icon={CheckCircle2}
      size="md"
      onClose={onClose}
      closeLabel="Close export instructions"
      footer={<Button data-autofocus onClick={onClose}>Got it</Button>}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="eyebrow text-brand-700">Exported file</p>
          <p className="mt-1 break-all text-sm font-semibold text-brand-900">{filename}</p>
        </div>

        <ol className="space-y-3">
          <li className="flex gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Email the {fileLabel} to the Registrar</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {actorLabel} must attach the downloaded file and send it through the official email channel.
              </p>
            </div>
          </li>
          <li className="flex gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Wait for Registrar acknowledgement</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Keep the case at “Exported — Ready to Send” until the Registrar acknowledges the email outside the portal.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </Modal>
  );
}

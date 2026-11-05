// Gallery section for Modal, Drawer and ConfirmProvider (P1c). Rendered by pages/UiGallery.jsx; proven by
// e2e/ui-gallery-p1c.spec.js, which finds every opener through its data-open attribute.
import { useState } from "react";
import { Inbox } from "lucide-react";
import { Modal, Drawer } from "../components/ui/index.js";
import { useConfirm } from "../components/confirm";

const LONG_LINES = Array.from({ length: 28 }, (_, i) => `Line ${i + 1}: a long body scrolls inside the dialog while the header and the footer stay where they are.`);

function LongBody({ size }) {
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p className="meta">Modal {size}: the content is taller than the dialog on purpose.</p>
      {LONG_LINES.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p data-last-line="" className="font-semibold">The last line of the body.</p>
    </div>
  );
}

export default function ModalSection() {
  const confirm = useConfirm();
  const [open, setOpen] = useState(null); // which demo is open
  const [result, setResult] = useState("none");
  const close = () => setOpen(null);

  const ask = async (options) => setResult((await confirm(options)) ? "confirmed" : "cancelled");
  const opener = (key, label, extra = "") => (
    <button type="button" className="btn-ghost" data-open={key} onClick={() => setOpen(key)}>
      {label}{extra}
    </button>
  );
  const standardFooter = (
    <>
      <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
      <button type="button" className="btn-primary" onClick={close}>Save changes</button>
    </>
  );

  return (
    <section data-gallery="modals" className="card p-4 sm:p-5">
      <h2 className="section-title mb-4">Modal, Drawer and Confirm</h2>
      <div className="flex flex-wrap gap-2">
        {opener("sm", "Modal sm")}
        {opener("md", "Modal md")}
        {opener("lg", "Modal lg")}
        {opener("xl", "Modal xl")}
        {opener("short", "Short modal")}
        {opener("locked", "Saving (not dismissible)")}
        {opener("drawer-right", "Drawer right")}
        {opener("drawer-left", "Drawer left")}
        {opener("nested", "Modal with a confirm")}
        <button type="button" className="btn-ghost" data-open="confirm" onClick={() => ask({ title: "Set as the current semester?", message: "AY 2026-2027 1st Semester\n\nEnrollment, course adjustments, and planning will use this semester from now on.", confirmLabel: "Set as current" })}>
          Confirm
        </button>
        <button type="button" className="btn-ghost text-red-600" data-open="confirm-danger" onClick={() => ask({ title: "Remove this record?", message: "This cannot be undone.", confirmLabel: "Remove record", tone: "danger" })}>
          Destructive confirm
        </button>
      </div>
      <p className="meta mt-3">
        Last confirm answer: <output data-gallery="confirm-result" aria-live="polite" className="font-semibold text-slate-700">{result}</output>
      </p>

      {/* I-040: a page wrapper with space-y-5 put 20px of margin on a backdrop rendered in place. The opener lives in one. */}
      <div data-gallery="space-y-host" className="mt-4 space-y-5">
        <p className="meta">A wrapper with space-y-5: its later children get margin-top 20px.</p>
        {opener("space-y", "Modal opened from a space-y parent")}
        {/* rendered here, as a later child of the space-y wrapper, exactly where the real pages render their dialogs */}
        {open === "space-y" && (
          <Modal size="md" title="Modal from a space-y parent" onClose={close} footer={standardFooter}>
            <p className="text-sm text-slate-700">The backdrop covers the whole viewport, top edge included.</p>
          </Modal>
        )}
      </div>

      {["sm", "md", "lg", "xl"].map((size) =>
        open === size ? (
          <Modal key={size} size={size} title={`Modal ${size}`} subtitle="Header and footer stay; the body scrolls." icon={Inbox} onClose={close} footer={standardFooter}>
            <LongBody size={size} />
          </Modal>
        ) : null
      )}
      {open === "short" && (
        <Modal size="sm" title="Short modal" subtitle="Subtitle: describes the dialog for screen readers." onClose={close} footer={standardFooter}>
          <label className="field-label" htmlFor="gallery-modal-name">Name</label>
          <input id="gallery-modal-name" className="field-input" placeholder="First control of the body" />
        </Modal>
      )}
      {open === "locked" && (
        <Modal size="sm" title="Saving" dismissible={false} onClose={close} footer={<button type="button" className="btn-primary" onClick={close}>Finish saving</button>}>
          <p className="text-sm text-slate-700">While saving, Escape, the backdrop and the X button do nothing.</p>
        </Modal>
      )}
      {open === "nested" && (
        <Modal
          size="md"
          title="Modal with a confirm"
          onClose={close}
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={close}>Close</button>
              <button type="button" className="btn-danger" onClick={() => ask({ title: "Discard this draft?", message: "The unsaved changes are lost.", confirmLabel: "Discard", tone: "danger" })}>
                Discard draft
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-700">The confirm opens one layer above this dialog.</p>
        </Modal>
      )}
      {(open === "drawer-right" || open === "drawer-left") && (
        <Drawer side={open === "drawer-left" ? "left" : "right"} label={open === "drawer-left" ? "Drawer left" : "Drawer right"} onClose={close}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
            <h2 className="section-title">{open === "drawer-left" ? "Drawer left" : "Drawer right"}</h2>
            <button type="button" className="btn-ghost" onClick={close}>Close drawer</button>
          </div>
          <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
            <label className="field-label" htmlFor="gallery-drawer-search">Search</label>
            <input id="gallery-drawer-search" className="field-input" />
            {LONG_LINES.slice(0, 12).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Drawer>
      )}
    </section>
  );
}

// PageHelp (UX-14, owner 2026-11-20): every process page has ONE "Help" button in its header. The rules that apply,
// the form and Operations Manual numbers, "How this works" and the recent activity all live in the side panel it opens,
// so the page itself starts with the work. Used by the process boards (ProcessBoardPage), the single workflow pages
// (WorkflowPage) and the Dean's Practicum board - the same parts on every page of that kind (IM24).
import { BookOpen, HelpCircle, History, X } from "lucide-react";
import { Button } from "./ui/Button.jsx";
import { Drawer } from "./ui/Modal.jsx";
import { BOARD_HELP } from "./StageBoard";
import { formRefLine } from "../lib/formRefs.js";

export function HelpButton({ onClick }) {
  return (
    <Button variant="secondary" icon={HelpCircle} onClick={onClick} aria-haspopup="dialog">
      Help
    </Button>
  );
}

/**
 * @param title         the page's name ("Help: Leave of Absence")
 * @param forms         a key of lib/formRefs.js: the "Forms GS-F-07 · Operations Manual 4.6" line
 * @param onGuide       opens the "How this works" guide (the panel closes first)
 * @param onActivity    opens the recent activity (optional)
 * @param onClose       closes the panel
 * @param note          a longer explanation (e.g. the steps of a protocol), shown as a paragraph
 * @param board         the page has a board: "move", "locked" or "view" (BOARD_HELP); says once how its cards move (UX-20)
 */
export function PageHelpDrawer({ title, forms, onGuide, onActivity, onClose, board = "", note = "" }) {
  const formsLine = forms ? formRefLine(forms) : "";
  const open = (fn) => () => {
    onClose();
    fn();
  };
  return (
    <Drawer label={`Help: ${title}`} onClose={onClose}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Help</p>
          <h2 className="section-title break-words">{title}</h2>
        </div>
        <Button variant="icon" icon={X} aria-label="Close help" onClick={onClose} />
      </div>
      <div className="space-y-4 p-5">
        {(onGuide || onActivity) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {onGuide && (
              <Button variant="secondary" icon={BookOpen} onClick={open(onGuide)} className="justify-start">
                How this works
              </Button>
            )}
            {onActivity && (
              <Button variant="secondary" icon={History} onClick={open(onActivity)} className="justify-start">
                Recent activity
              </Button>
            )}
          </div>
        )}
        {note && <p data-slot="help-note" className="text-sm text-slate-600">{note}</p>}
        {board && (
          <section aria-label="Using the board" data-slot="board-help">
            <h3 className="text-sm font-semibold text-ink">Using the board</h3>
            <p className="mt-1 text-sm text-slate-600">{BOARD_HELP[board] || BOARD_HELP.move}</p>
          </section>
        )}
        {/* CHANGED BY owner feedback 2026-11-23 (IM58): the rules show on the Business Rules page only */}
        {formsLine && (
          <p data-slot="forms" className="meta">
            {formsLine}
          </p>
        )}
      </div>
    </Drawer>
  );
}

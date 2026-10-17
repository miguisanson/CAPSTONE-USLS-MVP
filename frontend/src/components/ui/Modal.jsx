// Modal and Drawer (UI-SPEC section 4 "Modal" row, section 5 "Modals"). The one dialog shell of the app.
//
//   <Modal title="..." subtitle="..." icon={Icon} badge={<StatusChip/>} size="sm|md|lg|xl" onClose={fn}
//          footer={<>buttons</>} dismissible={saving ? false : true}>body</Modal>
//   <Drawer side="left|right" label="Menu" onClose={fn} width="w-72">anything</Drawer>
//
// Shape: a height-bounded flex column (max 90dvh). The header and the footer never move; only the body scrolls.
// Behaviour (shared by both): role="dialog" aria-modal, aria-labelledby (title) and aria-describedby (subtitle),
// the focus moves in, Tab and Shift+Tab stay inside, Escape and a click on the backdrop close it (unless
// dismissible={false}, e.g. while saving), and the focus goes back to the button that opened it. The page behind
// does not scroll while any dialog is open (counted, so a confirm over a modal keeps it locked).
//
// Rendered through a portal into <body>. That is the fix for I-040: a backdrop rendered in place inherited
// `.space-y-5 > * + * { margin-top: 20px }` from the page's wrapper, so it started 20 px down and the top of the sticky
// header showed through. Out of the page tree no ancestor's margin, transform or overflow can touch it.
//
// Layers (tailwind zIndex scale): header 30 < drawer 40 < modal 100 < confirm 110. A dialog opened while another one
// is open (a confirm over a modal) takes the confirm layer, and only the top one answers to Escape and Tab.
import { createElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const SIZE_CLASS = {
  sm: "max-w-md", // confirm, reasons
  md: "max-w-xl", // forms
  lg: "max-w-3xl", // case detail
  xl: "max-w-6xl", // previews, wide tables
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusablesIn(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
  );
}

// Open dialogs, oldest first. Only the last one reacts to the keyboard.
const openLayers = [];

// Page scroll lock with a counter: the first dialog locks, the last one to close unlocks.
let lockDepth = 0;
let savedOverflow = "";
function lockPageScroll() {
  if (lockDepth === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockDepth += 1;
}
function unlockPageScroll() {
  lockDepth = Math.max(0, lockDepth - 1);
  if (lockDepth === 0) document.body.style.overflow = savedOverflow;
}

function useDialogLayer(panelRef, onClose, dismissible) {
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const token = {};
    openLayers.push(token);
    const opener = document.activeElement;
    lockPageScroll();

    // Where the focus starts: an element marked data-autofocus, else the first control of the body or the footer,
    // else the close button, else the panel itself.
    const marked = panel.querySelector("[data-autofocus]:not([disabled])");
    const items = focusablesIn(panel);
    const header = panel.querySelector("[data-modal-header]");
    const firstOutsideHeader = items.find((el) => !header || !header.contains(el));
    (marked || firstOutsideHeader || items[0] || panel).focus({ preventScroll: true });

    const isTop = () => openLayers[openLayers.length - 1] === token;

    function onKeyDown(event) {
      if (!isTop()) return;
      if (event.key === "Escape") {
        if (!dismissibleRef.current) return;
        event.preventDefault();
        event.stopPropagation(); // a legacy dialog's own window listener must not also close
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusablesIn(panel);
      if (controls.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active) || active === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Safety net: if focus ever lands outside the top dialog (a script, a screen reader), pull it back in.
    function onFocusIn(event) {
      if (!isTop() || panel.contains(event.target)) return;
      (focusablesIn(panel)[0] || panel).focus({ preventScroll: true });
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const at = openLayers.indexOf(token);
      if (at >= 0) openLayers.splice(at, 1);
      unlockPageScroll();
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    };
  }, [panelRef]);
}

function Icon({ icon, className }) {
  if (!icon) return null;
  return isValidElement(icon) ? icon : createElement(icon, { className, "aria-hidden": "true" });
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ElementType|React.ReactElement} [props.icon]  a lucide icon
 * @param {"default"|"danger"} [props.tone]  colour of the icon tile
 * @param {React.ReactNode} [props.badge]  sits beside the title (a StatusChip)
 * @param {"sm"|"md"|"lg"|"xl"} [props.size]
 * @param {() => void} props.onClose
 * @param {React.ReactNode} [props.footer]  buttons; right-aligned, stacked full width below sm
 * @param {boolean} [props.dismissible]  false while saving: Escape, backdrop and the X button do nothing
 * @param {string} [props.closeLabel]  accessible name of the X button
 * @param {"auto"|"confirm"} [props.layer]  "confirm" forces the z-confirm layer; auto takes it when another dialog is open
 * @param {string} [props.describedBy]  id of the element that describes the dialog when there is no subtitle
 * @param {string} [props.className]  extra classes for the panel
 */
export function Modal({
  title,
  subtitle,
  icon,
  tone = "default",
  badge,
  size = "md",
  onClose,
  footer,
  dismissible = true,
  closeLabel = "Close",
  layer = "auto",
  describedBy,
  className = "",
  children,
}) {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef(null);
  // Decided once, when the dialog mounts: is another dialog already open underneath?
  const [stacked] = useState(() => openLayers.length > 0);
  useDialogLayer(panelRef, onClose, dismissible);

  const layerClass = layer === "confirm" || stacked ? "z-confirm" : "z-modal";
  const tile = tone === "danger" ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700";
  const hasBody = children !== undefined && children !== null && children !== false;

  return createPortal(
    <div
      data-modal-backdrop=""
      className={`fixed inset-0 m-0 ${layerClass} flex items-center justify-center bg-ink/50 p-3 backdrop-blur-sm sm:p-6`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || !dismissible) return;
        event.preventDefault(); // keep the mousedown from moving the focus after we hand it back to the opener
        onClose?.();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : describedBy}
        tabIndex={-1}
        className={`flex max-h-[90dvh] w-full ${SIZE_CLASS[size] || SIZE_CLASS.md} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift animate-fade-up focus:outline-none ${className}`}
      >
        <header data-modal-header="" className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          {icon && (
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tile}`}>
              <Icon icon={icon} className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id={titleId} className="section-title min-w-0 break-words">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p id={subtitleId} className="mt-1 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="btn-icon"
            aria-label={closeLabel}
            onClick={() => onClose?.()}
            disabled={!dismissible}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        {hasBody && (
          <div data-modal-body="" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {children}
          </div>
        )}
        {footer && (
          <footer
            data-modal-footer=""
            className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 max-sm:flex-col-reverse max-sm:[&>*]:min-h-11 max-sm:[&>*]:w-full"
          >
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}

/**
 * A panel that slides in from a side edge: the mobile menu (left) and record panels (right). The caller lays out
 * the inside; it should hold at least one control (a close button) so the focus has somewhere to go.
 * @param {object} props
 * @param {"left"|"right"} [props.side]
 * @param {string} props.label  accessible name of the drawer
 * @param {() => void} props.onClose
 * @param {string} [props.width]  Tailwind width classes; default w-72 on the left, up to max-w-xl on the right
 * @param {boolean} [props.dismissible]
 * @param {string} [props.className]
 */
export function Drawer({ side = "right", label, onClose, width, dismissible = true, className = "", children }) {
  const panelRef = useRef(null);
  useDialogLayer(panelRef, onClose, dismissible);

  const edge = side === "left" ? "left-0" : "right-0";
  const size = width || (side === "left" ? "w-72 max-w-[85vw]" : "w-full max-w-[calc(100vw-2.5rem)] sm:max-w-xl");

  return createPortal(
    <div
      data-modal-backdrop=""
      className="fixed inset-0 m-0 z-drawer bg-ink/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || !dismissible) return;
        event.preventDefault(); // keep the mousedown from moving the focus after we hand it back to the opener
        onClose?.();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`absolute inset-y-0 ${edge} flex flex-col overflow-y-auto bg-white shadow-lift animate-fade-up focus:outline-none ${size} ${className}`}
      >
        {children}
      </aside>
    </div>,
    document.body
  );
}

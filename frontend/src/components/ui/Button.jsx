// Button (UI-SPEC section 4). Wraps the existing button classes so a page writes <Button variant="danger"> instead of
// choosing class strings. `.btn` in index.css carries the shared shape and the 44px phone height.
import { createElement } from "react";

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-ghost", // the old name is kept in the CSS (218 uses)
  danger: "btn-danger",
  icon: "btn-icon",
};

// size="sm" is the compact table-row button; it keeps its 44px height on phones (touch target).
const SIZES = {
  md: "",
  sm: "px-3 py-1.5 text-xs min-h-0 max-sm:min-h-11",
};

const isDev = () => Boolean(import.meta.env && import.meta.env.DEV);

function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/**
 * @param variant  "primary" (default) | "secondary" | "danger" | "icon" (square, needs aria-label)
 * @param size     "md" (default) | "sm"; ignored by "icon"
 * @param icon     a lucide icon component shown before the children (the only content of an "icon" button)
 * @param loading  disables the button, sets aria-busy and shows a spinner in place of the icon
 * @param as       another tag or component (e.g. "a", Link); then no `type`, and a disabled state sets aria-disabled
 */
export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  as: Tag = "button",
  className = "",
  children,
  disabled,
  ...rest
}) {
  if (variant === "icon" && isDev() && !rest["aria-label"]) {
    console.warn("[Button] variant=\"icon\" needs an aria-label");
  }
  const off = Boolean(disabled || loading);
  const classes = `${VARIANTS[variant] || VARIANTS.primary} ${variant === "icon" ? "" : SIZES[size] || ""} ${className}`.replace(/\s+/g, " ").trim();
  const props = { ...rest, className: classes };
  if (Tag === "button") {
    props.type = rest.type || "button";
    props.disabled = off;
  } else if (off) {
    props["aria-disabled"] = true;
    props.tabIndex = -1;
    props.className += " pointer-events-none opacity-50";
  }
  if (loading) props["aria-busy"] = true;
  const mark = loading ? <Spinner /> : Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null;
  return createElement(Tag, props, mark, children);
}

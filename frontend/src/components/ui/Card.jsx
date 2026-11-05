// Card and SectionCard (UI-SPEC section 4). `.card` in index.css is the surface: rounded-2xl, white, hairline border.
import { createElement } from "react";

const PADS = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

/**
 * @param pad          "md" (default) | "sm" | "lg" | "none"
 * @param as           another tag (e.g. "section", "li") or component
 * @param interactive  pointer cursor and a green border on hover, for a card that is a button or link
 */
export function Card({ pad = "md", as: Tag = "div", interactive = false, className = "", children, ...rest }) {
  const classes = `card ${PADS[pad] ?? PADS.md} ${interactive ? "cursor-pointer transition-colors hover:border-brand-200" : ""} ${className}`
    .replace(/\s+/g, " ")
    .trim();
  return createElement(Tag, { ...rest, className: classes }, children);
}

/** Title block of a section: optional icon tile, h2, optional subtitle, optional action on the right. */
export function SectionTitle({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
        )}
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** A Card that opens with a SectionTitle; the body is spaced `space-y-4`. */
export function SectionCard({ title, subtitle, icon, action, pad = "md", className = "", children, ...rest }) {
  return (
    <Card pad={pad} className={className} {...rest}>
      <SectionTitle title={title} subtitle={subtitle} icon={icon} action={action} />
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

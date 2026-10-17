// PageHeader (UI-SPEC section 4): the one block every page opens with - title (.page-title), a short description,
// an optional icon tile, badge, back link and actions. The page's one <h1> comes from here.
// Layout: the title block and the actions share a row from sm up and wrap when they do not fit; below sm the actions
// always sit under the title, left-aligned (UI-SPEC section 5, 390 px). Props are a superset of the old
// components/ui.jsx PageHeader ({ title, description, icon, actions, badge }).
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * @param title        the page title
 * @param description  one short line under the title
 * @param icon         a lucide icon component; shown in a 44px tile from sm up
 * @param actions      buttons for the right-hand side (under the title on phones)
 * @param badge        a StatusChip or similar, shown beside the title
 * @param back         `{ to, label }` (label defaults to "Back") - a link above the title
 * @param level        heading level of the title (default 1; use 2 for a second header on the same page)
 * @param titleProps   extra props for the heading element (e.g. an id)
 * @param className    extra classes on the wrapper
 */
export function PageHeader({ title, description, icon: Icon, actions = null, badge = null, back = null, level = 1, titleProps = {}, className = "", ...rest }) {
  const Heading = level === 2 ? "h2" : level === 3 ? "h3" : "h1";
  return (
    <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`.trim()} {...rest}>
      <div className="min-w-0 flex-1 basis-full sm:basis-96">
        {back && (
          <Link
            to={back.to}
            data-slot="back"
            className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:underline max-sm:min-h-11"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {back.label || "Back"}
          </Link>
        )}
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span data-slot="icon" className="mt-0.5 hidden h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 sm:grid">
              <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Heading {...titleProps} className={`page-title min-w-0 break-words ${titleProps.className || ""}`.trim()}>
                {title}
              </Heading>
              {badge && <span data-slot="badge" className="inline-flex">{badge}</span>}
            </div>
            {description && (
              <p data-slot="description" className="mt-1 max-w-3xl text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div data-slot="actions" className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {actions}
        </div>
      )}
    </header>
  );
}

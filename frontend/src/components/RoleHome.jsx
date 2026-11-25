// RoleHome (owner decision IM19): the one action-first home layout every role uses.
//   1. "Needs your action" - a list of what waits on this person, each row with a link to where it is handled;
//   2. three or four key numbers (StatCard);
//   3. a short recent-activity list with a "View all" link;
//   plus an optional `extra` slot (the student home puts the lifecycle Stepper and its page links there).
// Layout (UI-SPEC section 2): one column below lg, in the order actions, key numbers, extra, activity; from lg two
// columns - the wide one holds the actions and the extra block, the narrow one (20rem) holds the key numbers and the
// activity. Built only from the component library; nothing here knows about a role.
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CheckCircle2, Hourglass, ListChecks } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatCard } from "./ui/index.js";
import { useAuth } from "../auth";
import { useSeenMarks } from "../lib/seenMarks";

/** The most recent-activity entries shown; the "View all" link leads to the rest. */
export const MAX_ACTIVITY = 6;
/** The rows shown in the "waiting on" group; its "View all" link leads to the rest. */
export const MAX_WAITING = 3;

/**
 * @param header         PageHeader props: { title, description, icon, badge, actions }
 * @param actions        [{ key, title, detail, meta, tone, chip, to, linkLabel }] - what waits on the viewer.
 *                       `title` names the item, `detail` is one line under it, `meta` is the due date / age (string),
 *                       `overdue` paints the meta red (it already says "Overdue"),
 *                       `chip` is a StatusChip (or any node), `to` + `linkLabel` is the button that opens it.
 * @param actionsTitle   heading of the list (default "Needs your action")
 * @param actionsSubtitle one short line under the heading
 * @param actionsEmpty   { title, hint } shown when `actions` is empty (default "Nothing is waiting on you")
 * @param actionsAll     optional { to, label } "View all" link in the heading, for a list that is capped (the back-office home)
 * @param waiting        optional second group under the actions for things that wait on SOMEONE ELSE (AD7: an office
 *                       holds the task, the viewer has nothing to do): { title, subtitle, items, all: { to, label } }.
 *                       Same row shape as `actions`, at most MAX_WAITING rows, hidden when `items` is empty.
 * @param stats          3-4 StatCard prop objects ({ label, value, sub, to, icon, tone, badge })
 * @param activity       [{ key, title, detail, time, to, unread }] newest first; the first MAX_ACTIVITY are shown.
 *                       `null` leaves the activity card out (a role that may not read the activity log)
 * @param activityTitle  heading (default "Recent activity")
 * @param activityAll    { to, label } the "View all" link
 * @param activityEmpty  { title, hint } shown when `activity` is empty
 * @param extra          a node shown under the actions (before the activity on a phone)
 * @param activityWide   true puts the activity card in the wide column under the actions (UX-33: the faculty home's
 *                       "Upcoming defenses" is a work list, not a side note); default false keeps it in the narrow one
 * @param notice         an optional node (an InlineNotice) shown between the header and the columns
 */
export default function RoleHome({
  header,
  actions = [],
  actionsTitle = "Needs your action",
  actionsSubtitle,
  actionsEmpty = {},
  actionsAll,
  waiting,
  stats = [],
  activity = [],
  activityTitle = "Recent activity",
  activityAll,
  activityEmpty = {},
  extra = null,
  notice = null,
  activityWide = false,
}) {
  const shownActivity = (activity || []).slice(0, MAX_ACTIVITY);
  // Owner 2026-11-08: a "Needs your action" row the person has not opened yet is green with a "New" mark.
  const { user } = useAuth();
  const seen = useSeenMarks(`actions:${user?.id || "guest"}`);
  const waitingItems = waiting?.items || [];
  const activityCard = activity !== null && (
    <SectionCard
      as="section"
      title={activityTitle}
      icon={Activity}
      action={
        activityAll && (
          <Link
            to={activityAll.to}
            className="inline-flex shrink-0 items-center text-sm font-semibold text-brand-700 hover:underline max-sm:min-h-11"
          >
            {activityAll.label || "View all"}
          </Link>
        )
      }
      className="order-4 lg:order-none"
    >
      {shownActivity.length ? (
        <ul className="space-y-3">
          {shownActivity.map((entry) => (
            <ActivityRow key={entry.key ?? entry.title} entry={entry} />
          ))}
        </ul>
      ) : (
        <EmptyState size="sm" title={activityEmpty.title || "No activity yet"} hint={activityEmpty.hint} />
      )}
    </SectionCard>
  );
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader {...header} />
      {notice}
      {/* Below lg the two column wrappers dissolve (`contents`) so `order` can interleave their children. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <SectionCard
            as="section"
            title={actionsTitle}
            subtitle={actionsSubtitle}
            icon={ListChecks}
            action={
              actionsAll && (
                <Link
                  to={actionsAll.to}
                  className="inline-flex shrink-0 items-center text-sm font-semibold text-brand-700 hover:underline max-sm:min-h-11"
                >
                  {actionsAll.label || "View all"}
                </Link>
              )
            }
            className="order-1 lg:order-none"
          >
            {actions.length ? (
              <ul className="space-y-2">
                {actions.map((item) => {
                  const id = String(item.key ?? item.title);
                  return <ActionRow key={id} item={item} fresh={!seen.marks[id]} onOpen={() => seen.mark(id)} />;
                })}
              </ul>
            ) : (
              <EmptyState
                size="sm"
                icon={CheckCircle2}
                title={actionsEmpty.title || "Nothing is waiting on you"}
                hint={actionsEmpty.hint || "New requests and replies will appear here."}
              />
            )}
          </SectionCard>
          {waitingItems.length > 0 && (
            <SectionCard
              as="section"
              title={waiting.title || "Waiting on others"}
              subtitle={waiting.subtitle}
              icon={Hourglass}
              action={
                waiting.all && (
                  <Link
                    to={waiting.all.to}
                    className="inline-flex shrink-0 items-center text-sm font-semibold text-brand-700 hover:underline max-sm:min-h-11"
                  >
                    {waiting.all.label || "View all"}
                  </Link>
                )
              }
              className="order-1 lg:order-none"
            >
              <ul className="space-y-2">
                {waitingItems.slice(0, MAX_WAITING).map((item) => (
                  <ActionRow key={item.key ?? item.title} item={item} />
                ))}
              </ul>
            </SectionCard>
          )}
          {activityWide && activityCard}
          {extra && <div className="order-3 space-y-5 lg:order-none">{extra}</div>}
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          {stats.length > 0 && (
            <div
              data-slot="stats"
              className="order-2 grid grid-cols-2 gap-3 lg:order-none [&>*:last-child:nth-child(odd)]:col-span-2"
            >
              {stats.map((stat) => (
                <StatCard key={stat.key ?? stat.label} {...stat} />
              ))}
            </div>
          )}
          {!activityWide && activityCard}
        </div>
      </div>
    </div>
  );
}

// The arrow's name for a screen reader and its tooltip: a lone verb ("Review") names the row; a page name ("Defense
// Schedule") becomes "Open Defense Schedule"; a full phrase ("Open Leave of Absence") is kept.
const VERB = /^(Open|Review|Answer|Reply|View|Go|Sign|Decide|Request|Upload|File)\b/;
export function arrowLabel(linkLabel, title) {
  const label = String(linkLabel || "").trim();
  if (!label) return `Open ${title}`;
  if (VERB.test(label)) return label.split(/\s+/).length === 1 ? `${label} ${title}` : label;
  return `Open ${label}`;
}

function ActionRow({ item, fresh = false, onOpen }) {
  const { title, detail, meta, overdue = false, chip, to, linkLabel } = item;
  // UX-12 (owner 2026-11-20): a row not opened yet has a small dot - no "New" badge, no green row; the link is an arrow.
  // UX-13: the due line says "Overdue" itself (in red), so the row carries no second Overdue chip.
  return (
    <li
      data-fresh={fresh ? "true" : undefined}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span className="mt-1.5 flex h-2 w-2 shrink-0">
          {fresh && <span role="img" aria-label="Not opened yet" title="Not opened yet" className="h-2 w-2 rounded-full bg-brand-600" />}
        </span>
        <div className="min-w-0">
          <p className={`break-words text-sm text-ink ${fresh ? "font-bold" : "font-semibold"}`}>{title}</p>
          {detail && <p className="meta mt-0.5 break-words">{detail}</p>}
          {(meta || chip) && (
            <p className="meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {chip}
              {meta && <span className={overdue ? "font-semibold text-red-700" : undefined}>{meta}</span>}
            </p>
          )}
        </div>
      </div>
      {to && (
        <Link
          to={to}
          onClick={onOpen}
          aria-label={arrowLabel(linkLabel, title)}
          title={arrowLabel(linkLabel, title)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors duration-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:h-11 max-sm:w-11"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

function ActivityRow({ entry }) {
  const { title, detail, time, to, unread } = entry;
  return (
    <li className="min-w-0">
      <p className="flex items-start gap-2 text-sm font-semibold text-ink">
        {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" role="img" />}
        {to ? (
          <Link to={to} className="min-w-0 break-words hover:text-brand-700 hover:underline">
            {title}
          </Link>
        ) : (
          <span className="min-w-0 break-words">{title}</span>
        )}
      </p>
      {detail && <p className="meta mt-0.5 line-clamp-2 break-words">{detail}</p>}
      {time && <p className="meta mt-0.5">{time}</p>}
    </li>
  );
}

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
import { Button, EmptyState, PageHeader, SectionCard, StatCard } from "./ui/index.js";
import { toneOf } from "../lib/tone";

/** The most recent-activity entries shown; the "View all" link leads to the rest. */
export const MAX_ACTIVITY = 6;
/** The rows shown in the "waiting on" group; its "View all" link leads to the rest. */
export const MAX_WAITING = 3;

/**
 * @param header         PageHeader props: { title, description, icon, badge, actions }
 * @param actions        [{ key, title, detail, meta, tone, chip, to, linkLabel }] - what waits on the viewer.
 *                       `title` names the item, `detail` is one line under it, `meta` is the due date / age (string),
 *                       `tone` is success | warning | danger | info | neutral (the dot before the title),
 *                       `chip` is a StatusChip (or any node), `to` + `linkLabel` is the button that opens it.
 * @param actionsTitle   heading of the list (default "Needs your action")
 * @param actionsSubtitle one short line under the heading
 * @param actionsEmpty   { title, hint } shown when `actions` is empty (default "Nothing is waiting on you")
 * @param waiting        optional second group under the actions for things that wait on SOMEONE ELSE (AD7: an office
 *                       holds the task, the viewer has nothing to do): { title, subtitle, items, all: { to, label } }.
 *                       Same row shape as `actions`, at most MAX_WAITING rows, hidden when `items` is empty.
 * @param stats          3-4 StatCard prop objects ({ label, value, sub, to, icon, tone, badge })
 * @param activity       [{ key, title, detail, time, to, unread }] newest first; the first MAX_ACTIVITY are shown
 * @param activityTitle  heading (default "Recent activity")
 * @param activityAll    { to, label } the "View all" link
 * @param activityEmpty  { title, hint } shown when `activity` is empty
 * @param extra          a node shown under the actions (before the activity on a phone)
 */
export default function RoleHome({
  header,
  actions = [],
  actionsTitle = "Needs your action",
  actionsSubtitle,
  actionsEmpty = {},
  waiting,
  stats = [],
  activity = [],
  activityTitle = "Recent activity",
  activityAll,
  activityEmpty = {},
  extra = null,
}) {
  const shownActivity = activity.slice(0, MAX_ACTIVITY);
  const waitingItems = waiting?.items || [];
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader {...header} />
      {/* Below lg the two column wrappers dissolve (`contents`) so `order` can interleave their children. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <SectionCard
            as="section"
            title={actionsTitle}
            subtitle={actionsSubtitle}
            icon={ListChecks}
            className="order-1 lg:order-none"
          >
            {actions.length ? (
              <ul className="space-y-2">
                {actions.map((item) => (
                  <ActionRow key={item.key ?? item.title} item={item} />
                ))}
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
        </div>
      </div>
    </div>
  );
}

function ActionRow({ item }) {
  const { title, detail, meta, tone = "neutral", chip, to, linkLabel } = item;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${toneOf(tone).dot}`} />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">{title}</p>
          {detail && <p className="meta mt-0.5 break-words">{detail}</p>}
          {(meta || chip) && (
            <p className="meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {chip}
              {meta && <span>{meta}</span>}
            </p>
          )}
        </div>
      </div>
      {to && (
        <Button as={Link} to={to} variant="secondary" size="sm" className="shrink-0 gap-1.5 max-sm:w-full max-sm:justify-center">
          {linkLabel || "Open"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
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

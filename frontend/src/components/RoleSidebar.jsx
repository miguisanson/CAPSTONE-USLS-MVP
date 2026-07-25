import { GraduationCap } from "lucide-react";

function RoleNavItem({ item, active, onChange, mobile = false }) {
  const Icon = item.icon;
  const selected = active === item.id;
  return (
    <button
      type="button"
      onClick={() => onChange(item.id)}
      aria-current={selected ? "page" : undefined}
      className={`${mobile ? "inline-flex shrink-0 px-3 py-2 text-xs" : "flex w-full px-3 py-2.5 text-left text-sm"} cursor-pointer items-center gap-3 rounded-xl font-semibold transition-colors duration-200 ${
        selected
          ? "bg-brand-600 text-white shadow-sm"
          : mobile
            ? "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
      }`}
    >
      {item.number != null && (
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
          {item.number}
        </span>
      )}
      <Icon className={`${mobile ? "h-4 w-4" : "h-[18px] w-[18px]"} shrink-0`} />
      <span>{item.label}</span>
    </button>
  );
}

export default function RoleSidebar({ roleLabel, groups, items = [], active, onChange }) {
  const navigationGroups = groups?.length
    ? groups.filter((group) => group.items?.length)
    : [{ label: "Workflow Overview", items }];
  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex items-center gap-3 px-5 py-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"><GraduationCap className="h-6 w-6" /></span>
            <div className="leading-tight"><p className="font-display text-[15px] font-semibold text-ink">USLS Graduate School</p><p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{roleLabel}</p></div>
          </div>
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label={`${roleLabel} navigation`}>
            {navigationGroups.map((group) => (
              <section key={group.label} aria-labelledby={`${roleLabel}-${group.label}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}>
                <p id={`${roleLabel}-${group.label}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()} className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => <RoleNavItem key={item.id} item={item} active={active} onChange={onChange} />)}
                </div>
              </section>
            ))}
          </nav>
          <p className="border-t border-slate-200 px-5 py-4 text-[11px] leading-relaxed text-slate-400">Only transactions assigned to this role are shown.</p>
        </div>
      </aside>
      <nav className="flex gap-4 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label={`${roleLabel} navigation`}>
        {navigationGroups.map((group) => (
          <div key={group.label} className="flex shrink-0 items-center gap-2" role="group" aria-label={group.label}>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.label}</span>
            {group.items.map((item) => <RoleNavItem key={item.id} item={item} active={active} onChange={onChange} mobile />)}
          </div>
        ))}
      </nav>
    </>
  );
}

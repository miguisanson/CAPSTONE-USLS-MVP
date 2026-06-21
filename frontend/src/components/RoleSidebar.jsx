import { GraduationCap } from "lucide-react";

export default function RoleSidebar({ roleLabel, items, active, onChange }) {
  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex items-center gap-3 px-5 py-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"><GraduationCap className="h-6 w-6" /></span>
            <div className="leading-tight"><p className="font-display text-[15px] font-semibold text-ink">USLS Graduate School</p><p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{roleLabel}</p></div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6" aria-label={`${roleLabel} navigation`}>
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workflow overview</p>
            {items.map((item, index) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-current={selected ? "page" : undefined} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 ${selected ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${selected ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <p className="border-t border-slate-200 px-5 py-4 text-[11px] leading-relaxed text-slate-400">Only transactions assigned to this role are shown.</p>
        </div>
      </aside>
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label={`${roleLabel} navigation`}>
        {items.map((item, index) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-current={selected ? "page" : undefined} className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-brand-50"}`}><span>{index + 1}</span><Icon className="h-4 w-4" />{item.label}</button>;
        })}
      </nav>
    </>
  );
}

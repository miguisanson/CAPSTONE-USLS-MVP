import { GraduationCap, LogOut } from "lucide-react";
import RoleSidebar from "./RoleSidebar";
import Assistant from "../pages/Assistant";

// Full page shell (sidebar + header) around the policy chat, for role portals
// whose navigation is state-driven (Dean, Faculty).
export default function RoleAssistantPage({ roleLabel, groups, active, onChange, user, logout }) {
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <RoleSidebar roleLabel={roleLabel} groups={groups} active={active} onChange={onChange} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><GraduationCap className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-display text-[15px] font-semibold text-ink">{roleLabel} · Policy Assistant</p>
            <p className="text-[11px] text-slate-400">{user?.full_name}</p>
          </div>
          <button type="button" onClick={logout} className="btn-ghost cursor-pointer"><LogOut className="h-4 w-4" /> Sign out</button>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8"><Assistant policyOnly /></main>
      </div>
    </div>
  );
}

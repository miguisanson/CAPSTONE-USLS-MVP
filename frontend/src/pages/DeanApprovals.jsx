import { useState } from "react";
import { Gavel, LogOut, CheckCircle2, RotateCcw, AlertTriangle, Inbox, Clock } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";
import { formatDate } from "../lib/format";

export default function DeanApprovals() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.approvals(), []);
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState({});
  const [msg, setMsg] = useState("");
  const [actErr, setActErr] = useState("");

  async function decide(plan, decision) {
    setBusy(plan.id);
    setMsg("");
    setActErr("");
    try {
      const res = await api.decideApproval(plan.id, { decision, note: note[plan.id] || "" });
      setMsg(res.message);
      refetch();
    } catch (e) {
      setActErr(e.message);
    } finally {
      setBusy(0);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
          <Gavel className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-display text-[15px] font-semibold text-ink">Dean · Approvals</p>
          <p className="text-[11px] text-slate-400">{user?.full_name}</p>
        </div>
        <button type="button" onClick={logout} className="btn-ghost">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold text-ink">Items awaiting your approval</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review what the Graduate School submitted, then approve or return it. Your decision is recorded against your account.
          </p>
        </div>

        {msg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {msg}
          </div>
        )}
        {actErr && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{actErr}</div>
        )}

        {loading ? (
          <Spinner label="Loading approvals…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load approvals" hint={error} />
        ) : (
          <>
            {data.pending.length === 0 ? (
              <Card className="p-6">
                <EmptyState icon={Inbox} title="Nothing to approve right now" hint="Submitted course-offering plans will appear here." />
              </Card>
            ) : (
              <div className="space-y-4">
                {data.pending.map((plan) => {
                  const offered = plan.offerings.filter((o) => o.status === "Offered" || o.status === "Suggested");
                  return (
                    <Card key={plan.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-display text-lg font-semibold text-ink">
                            Course offerings · {plan.program_code}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {plan.term_label} · {offered.length} subject(s) proposed · submitted {formatDate(plan.submitted_at)}
                          </p>
                        </div>
                        <StatusBadge value={plan.status} dot={false} />
                      </div>

                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2">Subject</th>
                              <th className="px-3 py-2">Demand</th>
                              <th className="px-3 py-2">Sections</th>
                              <th className="px-3 py-2">Decision</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.offerings.map((o) => (
                              <tr key={o.id} className="border-b border-slate-50">
                                <td className="px-4 py-2">
                                  <span className="font-semibold text-ink">{o.code}</span>
                                  <span className="ml-1 text-slate-500">{o.title}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{o.demand_count}</td>
                                <td className="px-3 py-2 text-slate-600">{o.section_count}</td>
                                <td className="px-3 py-2"><StatusBadge value={o.status} dot={false} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <input
                        value={note[plan.id] || ""}
                        onChange={(e) => setNote((n) => ({ ...n, [plan.id]: e.target.value }))}
                        placeholder="Optional note to the Graduate School…"
                        className="field-input mt-3"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busy === plan.id} onClick={() => decide(plan, "approve")} className="btn-primary">
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </button>
                        <button type="button" disabled={busy === plan.id} onClick={() => decide(plan, "return")} className="btn-ghost">
                          <RotateCcw className="h-4 w-4" /> Return for revision
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {data.recent?.length > 0 && (
              <Card className="mt-6 p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Recent decisions
                </p>
                <ul className="divide-y divide-slate-100">
                  {data.recent.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">
                        {p.program_code} · {p.term_label}
                        {p.approved_by && <span className="text-slate-400"> · by {p.approved_by}</span>}
                      </span>
                      <StatusBadge value={p.status} dot={false} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { api } from "../api";
import { Button, SectionCard, StatusChip } from "./ui/index.js";
import { useConfirm } from "./confirm";
import { formatDateTime } from "../lib/format";

// The Academic Coordinator's explicit approve-then-publish step for the whole semester's class schedule (IM38-IM41).
// Faculty and students see the schedule only once it is published; a published schedule cannot be edited.
const HELP = {
  none: "Prepare the semester schedule to collect every offered class and its meeting times in one draft.",
  Draft: "Approving locks the draft. Faculty and students see nothing until you publish it.",
  Approved: "Publishing shows the schedule to faculty and students and sends a notice to each. A published schedule cannot be edited.",
  Published: "Faculty and students can see this schedule. It cannot be edited.",
};

export default function SemesterSchedulePanel({ termId, setError, setNotice }) {
  const confirm = useConfirm();
  const [plan, setPlan] = useState(undefined);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { setPlan((await api.teachingSchedules({ term_id: termId || undefined })).plan || null); }
    catch (err) { setPlan(null); setError(err.message); }
  }, [termId, setError]);
  useEffect(() => { setPlan(undefined); load(); }, [load]);

  async function run(key, call, done) {
    setBusy(key); setError(""); setNotice("");
    try { const res = await call(); setPlan(res.plan); setNotice(done); }
    catch (err) { setError(err.message); load(); }
    finally { setBusy(""); }
  }
  async function step(action, title, message, label, done) {
    if (await confirm({ title, message, confirmLabel: label })) run(action, () => api.updateTeachingSchedule(plan.id, { action, version: plan.version }), done);
  }
  if (plan === undefined) return null;
  const status = plan?.status === "Archived" ? null : plan?.status;
  const when = status === "Published" ? plan.published_at : status === "Approved" ? plan.approved_at : null;
  const problems = status === "Draft" ? plan.errors || [] : [];
  return <SectionCard as="section" aria-label="Semester schedule" icon={CalendarCheck} title="Semester schedule" subtitle={HELP[status || "none"]}
    action={status ? <StatusChip status={status} /> : <StatusChip status="Not Started" label="Not prepared" />}>
    {when && <p className="text-sm text-slate-600">{status} on {formatDateTime(when)}</p>}
    {problems.length > 0 && <ul className="list-inside list-disc text-sm text-amber-800">{problems.slice(0, 3).map((p) => <li key={p}>{p}</li>)}</ul>}
    <div className="flex flex-wrap gap-2">
      {!status && <Button loading={busy === "draft"} disabled={Boolean(busy)} onClick={() => run("draft", () => api.createTeachingSchedule({ term_id: termId || undefined, action: "draft" }), "Semester schedule draft prepared.")}>Prepare the semester schedule</Button>}
      {status === "Draft" && <Button loading={busy === "approve"} disabled={Boolean(busy) || problems.length > 0} onClick={() => step("approve", "Approve the semester schedule?", "The draft is locked. Faculty and students do not see it until you publish.", "Approve schedule", "Semester schedule approved.")}>Approve schedule</Button>}
      {status === "Approved" && <Button loading={busy === "publish"} disabled={Boolean(busy)} onClick={() => step("publish", "Publish the semester schedule?", "Faculty and students are notified and see this schedule. It cannot be edited afterwards.", "Publish schedule", "Semester schedule published.")}>Publish schedule</Button>}
    </div>
  </SectionCard>;
}

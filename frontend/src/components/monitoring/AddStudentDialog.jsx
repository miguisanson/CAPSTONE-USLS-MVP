import { useId, useState } from "react";
import { X, UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { ErrorNote } from "../ui";
import { Field, Input, Select } from "../forms";

const EMPTY = {
  student_number: "",
  first_name: "",
  last_name: "",
  program_id: "",
  academic_year_entry: "",
  email: "",
  adviser_name: "",
  enrollment_tag: "Enrolled",
};

// "Add student" form: same required fields and duplicate checks as the sheet import.
export default function AddStudentDialog({ programs = [], defaultProgramId = "", onClose, onCreated }) {
  const [form, setForm] = useState({ ...EMPTY, program_id: String(defaultProgramId || "") });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [possible, setPossible] = useState(null);
  const [created, setCreated] = useState(null);
  const titleId = useId();


  function set(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setPossible(null);
    };
  }

  async function submit(event, confirmDuplicate = false) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.createMonitoringStudent({
        ...form,
        program_id: Number(form.program_id) || undefined,
        confirm_possible_duplicate: confirmDuplicate || undefined,
      });
      setCreated(result);
      onCreated?.(result);
    } catch (e) {
      setError(e.message);
      // The API sends the matching record in the body for a possible duplicate; the
      // shared request helper only keeps the message, so detect it by the wording.
      if (/already in .* with the same name/i.test(e.message)) setPossible(e.message);
    } finally {
      setBusy(false);
    }
  }

  const ready = form.student_number.trim() && form.first_name.trim() && form.last_name.trim()
    && form.program_id && form.academic_year_entry.trim();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold text-ink">
              <UserPlus className="h-5 w-5 text-brand-700" aria-hidden="true" /> Add student
            </h2>
            <p className="mt-1 text-xs text-slate-500">Recorded as a manual entry with your name and the time. A student login is created, like the sheet import does.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100" aria-label="Close add student form">
            <X className="h-4 w-4" />
          </button>
        </div>

        {created ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{created.message}</p>
                <p className="mt-1">Student portal login: <span className="font-semibold">{created.account?.email}</span>.</p>
                {created.account?.must_change_password ? (
                  <p className="mt-1">
                    Initial password (shown only now): <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold">{created.account.password}</code>.
                    Give it to the student; they must choose their own password at first sign-in.
                  </p>
                ) : (
                  <p className="mt-1">The first-login password is the shared demo password, the same one the sheet import gives new students.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Done</button>
              <button type="button" className="btn-primary" onClick={() => { onClose(); onCreated?.(created, true); }}>Add subjects now</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student ID" required>
                <Input autoFocus value={form.student_number} onChange={set("student_number")} required maxLength={40} autoComplete="off" inputMode="numeric" placeholder="e.g. 1860101" />
              </Field>
              <Field label="Program" required>
                <Select value={form.program_id} onChange={set("program_id")} required options={programs.map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` }))} placeholder="Choose program" />
              </Field>
              <Field label="First name" required>
                <Input value={form.first_name} onChange={set("first_name")} required maxLength={80} autoComplete="off" />
              </Field>
              <Field label="Last name" required>
                <Input value={form.last_name} onChange={set("last_name")} required maxLength={80} autoComplete="off" />
              </Field>
              <Field label="School year / AY entry" required hint="Format 26-27 (or 2026-2027).">
                <Input value={form.academic_year_entry} onChange={set("academic_year_entry")} required maxLength={20} placeholder="26-27" autoComplete="off" />
              </Field>
              <Field label="Enrollment status">
                <Select value={form.enrollment_tag} onChange={set("enrollment_tag")} options={["Enrolled", "Not Enrolled"]} placeholder="" />
              </Field>
              <Field label="Email" hint="Leave blank to generate the school address.">
                <Input type="email" value={form.email} onChange={set("email")} maxLength={160} autoComplete="off" />
              </Field>
              <Field label="Adviser (optional)">
                <Input value={form.adviser_name} onChange={set("adviser_name")} maxLength={120} autoComplete="off" />
              </Field>
            </div>

            {possible && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p>{possible}</p>
                  <button type="button" disabled={busy} onClick={() => submit(null, true)} className="btn-ghost mt-2 px-3 py-1.5">Add as a separate student</button>
                </div>
              </div>
            )}
            {error && !possible && <ErrorNote message={error} />}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={busy || !ready} className="btn-primary">{busy ? "Saving…" : "Add student"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

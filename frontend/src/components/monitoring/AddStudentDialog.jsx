import { useId, useState } from "react";
import { UserPlus } from "lucide-react";
import { api } from "../../api";
import { Button, Field, InlineNotice, Input, Modal, Select } from "../ui/index.js";

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
  const formId = useId();

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

  // Two states in one window: the form, then the result (login and first password) once the student is created.
  const footer = created ? (
    <>
      <Button variant="secondary" onClick={onClose}>Done</Button>
      <Button onClick={() => { onClose(); onCreated?.(created, true); }}>Add subjects now</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button type="submit" form={formId} disabled={busy || !ready}>{busy ? "Saving…" : "Add student"}</Button>
    </>
  );

  return (
    <Modal
      title="Add student"
      icon={UserPlus}
      subtitle="Recorded as a manual entry with your name and the time. A student login is created, like the sheet import does."
      size="md"
      onClose={onClose}
      closeLabel="Close add student form"
      dismissible={!busy}
      footer={footer}
    >
      {created ? (
        <InlineNotice tone="success" icon title={created.message}>
          <p>Student portal login: <span className="font-semibold">{created.account?.email}</span>.</p>
          {created.account?.must_change_password ? (
            <p className="mt-1">
              Initial password (shown only now): <code className="rounded-md bg-white px-1.5 py-0.5 font-mono font-semibold">{created.account.password}</code>.
              Give it to the student; they must choose their own password at first sign-in.
            </p>
          ) : (
            <p className="mt-1">The first-login password is the shared demo password, the same one the sheet import gives new students.</p>
          )}
        </InlineNotice>
      ) : (
        <form id={formId} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Student ID" required>
              <Input data-autofocus="" value={form.student_number} onChange={set("student_number")} required maxLength={40} autoComplete="off" inputMode="numeric" placeholder="e.g. 1860101" />
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
            <InlineNotice tone="warning" icon role="alert">
              <p className="font-normal">{possible}</p>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => submit(null, true)} className="mt-2">Add as a separate student</Button>
            </InlineNotice>
          )}
          {error && !possible && <InlineNotice tone="danger">{error}</InlineNotice>}
        </form>
      )}
    </Modal>
  );
}

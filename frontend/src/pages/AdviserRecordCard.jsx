import { useState } from "react";
import { ChevronDown, ChevronUp, UserRoundPlus } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, ErrorNote, InlineNotice } from "../components/ui";
import { Field, Input, Select, Textarea } from "../components/forms";
import StudentPicker from "../components/StudentPicker";

// Collapsible form for a student whose adviser was appointed outside the portal
// (for example imported from the monitoring sheet). Staff, Research Coordinator and admin only.
export default function AdviserRecordCard({ onRecorded }) {
  const [open, setOpen] = useState(false);
  const { data: meta } = useApi(() => api.meta(), []);
  const [studentId, setStudentId] = useState(null);
  const [studentLabel, setStudentLabel] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [appointedOn, setAppointedOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const faculty = (meta?.faculty || []).map((person) => ({ value: String(person.id), label: person.college ? `${person.name} (${person.college})` : person.name }));

  async function submit(event) {
    event.preventDefault();
    if (!studentId || !facultyId) {
      setError("Choose the student and the adviser.");
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    try {
      const payload = { student_id: studentId, faculty_id: Number(facultyId) };
      if (appointedOn) payload.appointed_on = appointedOn;
      if (note.trim()) payload.note = note.trim();
      await api.recordAdviserAppointment(payload);
      setDone(`Recorded: ${faculty.find((item) => item.value === facultyId)?.label || "the adviser"} is now the adviser of ${studentLabel.split(" - ")[1] || studentLabel}.`);
      setStudentId(null);
      setStudentLabel("");
      setFacultyId("");
      setAppointedOn("");
      setNote("");
      onRecorded?.();
    } catch (e) {
      setError(`${e.message || "Could not record the appointment."} Nothing was recorded.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="adviser-record-form"
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserRoundPlus className="h-5 w-5" /></span>
          <span>
            <span className="block text-base font-semibold text-ink">Record an adviser appointed outside the portal</span>
            <span className="block text-sm text-slate-500">For students imported from the monitoring sheet who already have an adviser.</span>
          </span>
        </span>
        {open ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
      </button>
      {done && !open && <div className="mt-3"><InlineNotice>{done}</InlineNotice></div>}
      {open && (
        <form id="adviser-record-form" onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <span className="field-label">Student <span className="text-red-500">*</span></span>
            <StudentPicker
              value={studentId}
              selectedLabel={studentLabel}
              meta={meta}
              onChange={(id, label) => {
                setStudentId(id);
                setStudentLabel(label || "");
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Research adviser" required>
              <Select value={facultyId} options={faculty} placeholder="Choose the adviser" onChange={(event) => setFacultyId(event.target.value)} />
            </Field>
            <Field label="Appointment date" hint="Leave empty to use today.">
              <Input type="date" value={appointedOn} onChange={(event) => setAppointedOn(event.target.value)} />
            </Field>
          </div>
          <Field label="Note (optional)">
            <Textarea value={note} rows={2} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <ErrorNote message={error} />
          {done && <InlineNotice>{done}</InlineNotice>}
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Recording..." : "Record the appointment"}</button>
        </form>
      )}
    </Card>
  );
}

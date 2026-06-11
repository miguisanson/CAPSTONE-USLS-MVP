import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpenCheck, FileSpreadsheet, RefreshCw, AlertTriangle, Users, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

export default function CurriculumPlanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const [programId, setProgramId] = useState(selectedProgramId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function load(pid) {
    setLoading(true);
    setError("");
    api
      .curriculumPlanning(pid || undefined)
      .then((res) => {
        setData(res);
        setProgramId(String(res.program.id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(selectedProgramId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  async function generate() {
    if (!programId) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await api.generateCurriculum({ program_id: programId, scope: "active" });
      setMessage(res.message);
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Curriculum Planning</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review admitted and enrolled students, tag the curriculum basis, and generate required subject rows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={programId}
            onChange={(e) => setSearchParams({ program_id: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Program"
          >
            {(data?.programs || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
          <Link to={programId ? `/monitoring-sheet?program_id=${programId}` : "/monitoring-sheet"} className="btn-ghost">
            <FileSpreadsheet className="h-4 w-4" /> Monitoring Sheet
          </Link>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading curriculum planning..." />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load curriculum planning" hint={error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Metric icon={Users} label="Students" value={data.summary.students} tone="brand" />
            <Metric icon={CheckCircle2} label="Active" value={data.summary.active} tone="blue" />
            <Metric icon={AlertTriangle} label="Delayed / LOA" value={data.summary.delayed_or_loa} tone="amber" />
            <Metric icon={BookOpenCheck} label="Generated" value={data.summary.curriculum_generated} tone="brand" />
            <Metric icon={RefreshCw} label="Need generation" value={data.summary.needs_generation} tone="red" />
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Generate curriculum plan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Creates missing subject rows from the selected program curriculum for active students. Existing audit rows are kept.
                </p>
              </div>
              <button type="button" onClick={generate} disabled={busy} className="btn-primary">
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" /> Generate missing rows
                  </>
                )}
              </button>
            </div>
            {message && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{message}</p>}
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Card className="p-5 lg:col-span-4">
              <h2 className="mb-3 text-lg font-semibold text-ink">Curriculum subjects</h2>
              <div className="space-y-4">
                {data.categories.map((cat) => (
                  <div key={cat.name}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{cat.name}</p>
                    <ul className="space-y-1.5">
                      {cat.courses.map((course) => (
                        <li key={course.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                          <span className="font-semibold text-ink">{course.code}</span>
                          <span className="ml-1 text-slate-500">{course.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden lg:col-span-8">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-lg font-semibold text-ink">Student curriculum coverage</h2>
                <p className="text-sm text-slate-500">Students should show generated rows before audit and offering decisions.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-3 py-3">Stage</th>
                      <th className="px-3 py-3">Rows</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink">{student.name}</p>
                          <p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{student.current_stage}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {student.curriculum_rows}/{student.required_subjects}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge value={student.curriculum_status} dot={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone] || tones.brand}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

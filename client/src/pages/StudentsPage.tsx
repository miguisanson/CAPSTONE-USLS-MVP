import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import type { LifecycleStage, Paginated, StudentListItem } from "../types/domain";
import { readableEnum } from "../utils/format";

const STAGES: LifecycleStage[] = [
  "ADMISSION",
  "COURSEWORK",
  "PROPOSAL_DEVELOPMENT",
  "PROPOSAL_DEFENSE",
  "DATA_COLLECTION",
  "DISSERTATION_WRITING",
  "ORAL_DEFENSE",
  "LOA",
  "COMPLETED",
];

export const StudentsPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState<Paginated<StudentListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");
  const [program, setProgram] = useState<string>("");
  const [riskFlag, setRiskFlag] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const isStudent = (user?.roles ?? []).includes("STUDENT");

  const fetchStudents = async () => {
    try {
      setLoading(true);
      if (isStudent) {
        const me = await studentsApi.me();
        setData({
          items: [
            {
              id: me.id,
              studentNumber: me.studentNumber,
              firstName: me.firstName,
              lastName: me.lastName,
              email: me.email,
              currentStage: me.currentStage,
              riskFlag: me.riskFlag,
              program: me.program,
              adviser: me.adviser,
              researchCoordinator: me.researchCoordinator,
            },
          ],
          page: 1,
          pageSize: 1,
          total: 1,
        });
      } else {
        const result = await studentsApi.list({
          stage: stage || undefined,
          program: program || undefined,
          riskFlag: riskFlag || undefined,
          q: q || undefined,
          pageSize: 25,
        });
        setData(result);
      }
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStudents();
  }, [isStudent]); // initial + role-aware load

  const students = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Student Lifecycle Index</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All stages</option>
            {STAGES.map((item) => (
              <option key={item} value={item}>
                {readableEnum(item)}
              </option>
            ))}
          </select>
          <input
            value={program}
            onChange={(event) => setProgram(event.target.value)}
            placeholder="Program code/name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={riskFlag}
            onChange={(event) => setRiskFlag(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All risk flags</option>
            <option value="true">Risk = Yes</option>
            <option value="false">Risk = No</option>
          </select>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search student #, name, email"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void fetchStudents()}
            className="rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--gs-dark)]"
          >
            Apply Filters
          </button>
          <button
            onClick={() => {
              setStage("");
              setProgram("");
              setRiskFlag("");
              setQ("");
              setTimeout(() => void fetchStudents(), 0);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </section>

      {loading ? <LoadingBlock text="Loading students..." /> : null}
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Records ({data?.total ?? 0})</h2>
          </div>
          {students.length === 0 ? (
            <EmptyState message="No students match current filters." />
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Program</th>
                    <th className="px-2 py-2">Stage</th>
                    <th className="px-2 py-2">Risk</th>
                    <th className="px-2 py-2">Adviser</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-t border-slate-100">
                      <td className="px-2 py-2">
                        <p className="font-medium text-slate-800">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{student.studentNumber}</p>
                      </td>
                      <td className="px-2 py-2 text-slate-600">{student.program.code}</td>
                      <td className="px-2 py-2">{readableEnum(student.currentStage)}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            student.riskFlag ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {student.riskFlag ? "At Risk" : "Normal"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-600">{student.adviser?.fullName ?? "-"}</td>
                      <td className="px-2 py-2">
                        <Link
                          to={`/students/${student.id}`}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Open Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
};

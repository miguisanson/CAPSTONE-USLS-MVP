import { Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { LifecycleStage, Paginated, StudentListItem } from "../types/domain";
import { formatDate, readableEnum } from "../utils/format";
import { stageTone } from "../utils/presentation";

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

const PAGE_SIZE = 20;

export const StudentsPage = () => {
  const { user } = useAuth();
  const isStudent = (user?.roles ?? []).includes("STUDENT");
  const [data, setData] = useState<Paginated<StudentListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const [program, setProgram] = useState("");
  const [riskFlag, setRiskFlag] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [stage, program, riskFlag, q]);

  useEffect(() => {
    const load = async () => {
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
          const res = await studentsApi.list({
            stage: stage || undefined,
            program: program || undefined,
            riskFlag: riskFlag || undefined,
            q: q || undefined,
            page,
            pageSize: PAGE_SIZE,
          });
          setData(res);
        }
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isStudent, page, program, q, riskFlag, stage]);

  const students = data?.items ?? [];
  const atRiskCount = students.filter((student) => student.riskFlag).length;
  const completedCount = students.filter((student) => student.currentStage === "COMPLETED").length;

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    if (isStudent) return [];
    const actions: RecommendedActionItem[] = [];
    if (atRiskCount > 0) {
      actions.push({
        id: "at-risk",
        title: "Review flagged student cases",
        description: `${atRiskCount} student(s) are tagged at-risk. Review milestones, open tasks, and adviser follow-ups to prevent progression delays.`,
        priority: "high",
        owner: "Staff / Coordinators",
      });
    }
    const proposalStage = students.filter((student) => student.currentStage === "PROPOSAL_DEVELOPMENT").length;
    if (proposalStage >= 3) {
      actions.push({
        id: "proposal-load",
        title: "Manage proposal-development load",
        description: `${proposalStage} student(s) are in Proposal Development. Validate adviser capacity and pending review turnaround.`,
        priority: "medium",
      });
    }
    const loaCount = students.filter((student) => student.currentStage === "LOA").length;
    if (loaCount > 0) {
      actions.push({
        id: "loa-cases",
        title: "Monitor LOA status and return plans",
        description: `${loaCount} student(s) are currently on LOA. Confirm active monitoring and documented return timelines.`,
        priority: "medium",
      });
    }
    return actions;
  }, [atRiskCount, isStudent, students]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isStudent ? "My Student Record" : "Students"}
        subtitle={
          isStudent
            ? "View your graduate lifecycle progress, milestones, and monitored status."
            : "Filter and monitor graduate student records across lifecycle stages."
        }
      />

      {!isStudent ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Current Page Records"
            value={students.length}
            helper="Records loaded in the current view"
            icon={<Users className="h-5 w-5" />}
            actions={
              <QuickInsights
                title="Current Record Count"
                summary="Count of student rows currently loaded in this page view after active filters."
                recommendation="Use search and stage filters to narrow intervention-focused groups."
              />
            }
          />
          <KpiCard label="At-Risk on Page" value={atRiskCount} tone={atRiskCount > 0 ? "danger" : "success"} />
          <KpiCard label="Completed Stage" value={completedCount} tone="success" />
          <KpiCard label="Total in Scope" value={data?.total ?? 0} tone="primary" />
        </section>
      ) : null}

      {!isStudent ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Filter Students"
              subtitle="Search by student details and lifecycle context"
              insight={
                <QuickInsights
                  title="Student Filter Panel"
                  summary="Filters scope the student table by stage, program text, risk status, and free-text search."
                  recommendation="Apply filters before exporting or batch-reviewing records."
                />
              }
            />
            <div className="grid gap-2 md:grid-cols-5">
              <label className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search student number, name, or email"
                  className="h-10 w-full rounded-md border border-slate-300 pl-8 pr-3 text-sm outline-none focus:border-[var(--gs-primary)]"
                />
              </label>
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--gs-primary)]"
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
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--gs-primary)]"
              />
              <select
                value={riskFlag}
                onChange={(event) => setRiskFlag(event.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--gs-primary)]"
              >
                <option value="">All risk states</option>
                <option value="true">At risk only</option>
                <option value="false">On-track only</option>
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(1)}>
                Apply Filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStage("");
                  setProgram("");
                  setRiskFlag("");
                  setQ("");
                  setPage(1);
                }}
              >
                Reset
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading ? <LoadingBlock text="Loading student records..." /> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="table-cell-head">Student</th>
                    <th className="table-cell-head">Program</th>
                    <th className="table-cell-head">Current Stage</th>
                    <th className="table-cell-head">Risk</th>
                    <th className="table-cell-head">Next Owner</th>
                    <th className="table-cell-head">Open Tasks</th>
                    <th className="table-cell-head">Open Alerts</th>
                    <th className="table-cell-head">Last Activity</th>
                    <th className="table-cell-head">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td className="table-cell" colSpan={9}>
                        <EmptyState message="No students match the current filters." />
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 last:border-0">
                        <td className="table-cell">
                          <p className="font-semibold text-slate-900">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {student.studentNumber} | {student.email}
                          </p>
                        </td>
                        <td className="table-cell">{student.program.code}</td>
                        <td className="table-cell">
                          <Badge tone={stageTone(student.currentStage)}>{readableEnum(student.currentStage)}</Badge>
                        </td>
                        <td className="table-cell">
                          <Badge tone={student.riskFlag ? "danger" : "success"}>{student.riskFlag ? "At Risk" : "On Track"}</Badge>
                        </td>
                        <td className="table-cell">{student.nextActionOwnerRole ? readableEnum(student.nextActionOwnerRole) : "-"}</td>
                        <td className="table-cell">{student.openTaskCount ?? "-"}</td>
                        <td className="table-cell">{student.openAlertCount ?? "-"}</td>
                        <td className="table-cell">{student.lastActivityAt ? formatDate(student.lastActivityAt) : "-"}</td>
                        <td className="table-cell">
                          <Link to={`/students/${student.id}`} className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                            Open Profile
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {!isStudent && data ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Page {data.page} of {totalPages} | {data.total} total records
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {!isStudent ? (
        <RecommendedActions
          actions={recommendedActions}
          context="Page-level recommendations based on student risk indicators, lifecycle concentration, and current filtered scope."
        />
      ) : null}
    </div>
  );
};

import { Download, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { documentsApi, studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { DocumentRecord, StudentListItem } from "../types/domain";
import { formatDateTime, readableEnum } from "../utils/format";

export const DocumentsPage = () => {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isStudent = roles.includes("STUDENT");
  const canCreateChecklist = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER"].includes(role)
  );
  const canUpload = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER", "STUDENT"].includes(role)
  );
  const canDeleteVersion = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER", "PANEL_MEMBER", "STUDENT"].includes(role)
  );
  const canComment = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER", "PANEL_MEMBER"].includes(role)
  );

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklistItem, setChecklistItem] = useState("Proposal Manuscript");
  const [search, setSearch] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [deletingVersionIds, setDeletingVersionIds] = useState<Record<number, boolean>>({});

  const loadStudents = async () => {
    if (isStudent) {
      const me = await studentsApi.me();
      const row: StudentListItem = {
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
      };
      setStudents([row]);
      setStudentId(me.id);
      return;
    }
    const res = await studentsApi.list({ pageSize: 100 });
    setStudents(res.items);
    setStudentId((prev) => prev ?? res.items[0]?.id ?? null);
  };

  const loadDocuments = async (currentStudentId: number) => {
    const result = isStudent ? await documentsApi.my() : await documentsApi.byStudent(currentStudentId);
    setRecords(result);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await loadStudents();
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [isStudent]);

  useEffect(() => {
    if (!studentId) return;
    const run = async () => {
      try {
        setLoading(true);
        await loadDocuments(studentId);
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [studentId, isStudent]);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const query = search.toLowerCase();
    return records.filter((record) => {
      const fileName = record.versions[0]?.fileName.toLowerCase() ?? "";
      return (
        record.checklistItem.toLowerCase().includes(query) ||
        readableEnum(record.status).toLowerCase().includes(query) ||
        fileName.includes(query)
      );
    });
  }, [records, search]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const actions: RecommendedActionItem[] = [];
    const needsRevision = records.filter((record) => record.outstandingRevisionCount > 0);
    if (needsRevision.length > 0) {
      actions.push({
        id: "needs-revision",
        title: "Address outstanding revisions",
        description: `${needsRevision.length} document record(s) have unresolved revision notes. Follow up on feedback closure and revised uploads.`,
        priority: "high",
      });
    }
    const noVersions = records.filter((record) => record.versions.length === 0);
    if (noVersions.length > 0) {
      actions.push({
        id: "missing-upload",
        title: "Complete missing document submissions",
        description: `${noVersions.length} checklist item(s) have no uploaded versions yet.`,
        priority: "medium",
      });
    }
    const oldRevision = records.filter((record) =>
      record.revisionNotes.some((note) => !note.isResolved)
    );
    if (oldRevision.length > 0) {
      actions.push({
        id: "revision-closure",
        title: "Close long-running revision loops",
        description: `${oldRevision.length} document record(s) still have open revision notes. Validate whether comments are resolved and mark closure where appropriate.`,
        priority: "medium",
      });
    }
    return actions;
  }, [records]);

  const createRecord = async () => {
    if (!studentId) return;
    try {
      await documentsApi.createRecord(studentId, { checklistItem });
      await loadDocuments(studentId);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const uploadVersion = async (documentId: number, file: File) => {
    try {
      await documentsApi.uploadVersion(documentId, file);
      if (studentId) await loadDocuments(studentId);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const downloadVersion = async (versionId: number, fileName: string) => {
    try {
      const blob = await documentsApi.downloadVersion(versionId);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const deleteVersion = async (versionId: number) => {
    if (!studentId) return;
    if (!window.confirm("Delete this uploaded manuscript version? This cannot be undone.")) return;
    try {
      setDeletingVersionIds((prev) => ({ ...prev, [versionId]: true }));
      await documentsApi.deleteVersion(versionId);
      await loadDocuments(studentId);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDeletingVersionIds((prev) => ({ ...prev, [versionId]: false }));
    }
  };

  const addComment = async (documentId: number) => {
    const note = commentDrafts[documentId]?.trim();
    if (!note) return;
    try {
      await documentsApi.addComment(documentId, { note });
      setCommentDrafts((prev) => ({ ...prev, [documentId]: "" }));
      if (studentId) await loadDocuments(studentId);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const resolveComment = async (commentId: number, resolved: boolean) => {
    try {
      await documentsApi.resolveComment(commentId, resolved);
      if (studentId) await loadDocuments(studentId);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        subtitle="Checklist records, document versions, revision notes, and controlled access operations."
        help={{
          title: "Evidence and Revision Tracking",
          summary: "This module tracks required checklist items, submitted file versions, revision notes, and document review status.",
          recommendation: "Use checklist records as the source for completion evidence before approving milestone progress.",
        }}
      />

      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle
            title="Document Controls"
            subtitle="Select student context and create checklist records"
            insight={
              <QuickInsights
                title="Document Controls"
                summary="Document workflows are scoped by student, role policy, and checklist requirements."
                recommendation="Create checklist records before requesting student uploads."
              />
            }
          />
          <div className="grid gap-2 md:grid-cols-[260px_1fr_auto_auto]">
            <select
              value={studentId ?? ""}
              onChange={(event) => setStudentId(Number(event.target.value))}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              disabled={isStudent}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentNumber} - {student.firstName} {student.lastName}
                </option>
              ))}
            </select>
            <input
              value={checklistItem}
              onChange={(event) => setChecklistItem(event.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Checklist item"
            />
            {canCreateChecklist ? (
              <Button size="sm" onClick={() => void createRecord()}>
                Add Checklist Item
              </Button>
            ) : null}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search records"
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>
        </CardBody>
      </Card>

      {loading ? <LoadingBlock text="Loading document records..." /> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Document Repository"
              subtitle="Version history, revision notes, and workflow status"
              insight={
                <QuickInsights
                  title="Document Repository"
                  summary="Every record includes checklist status, version lineage, and revision-note tracking."
                  recommendation="Keep version history current and resolve revision notes to close document loops."
                />
              }
            />
            {filteredRecords.length === 0 ? (
              <EmptyState message="No document records found for current filters." />
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <article key={record.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{record.checklistItem}</p>
                        <p className="text-xs text-slate-600">
                          Status: {readableEnum(record.status)} | Outstanding revisions: {record.outstandingRevisionCount}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canUpload ? (
                          <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            <Upload className="h-3.5 w-3.5" />
                            Upload Version
                            <input
                              type="file"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  void uploadVersion(record.id, file);
                                  event.target.value = "";
                                }
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-slate-700">Versions</p>
                        {record.versions.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">No file versions uploaded yet.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {record.versions.map((version) => (
                              <li key={version.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5">
                                <div>
                                  <p className="text-xs font-semibold text-slate-800">
                                    {version.fileName}
                                  </p>
                                  <p className="text-xs text-slate-500">{formatDateTime(version.uploadedAt)}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Button size="sm" variant="outline" onClick={() => void downloadVersion(version.id, version.fileName)}>
                                    <Download className="h-3 w-3" />
                                    Download
                                  </Button>
                                  {canDeleteVersion ? (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => void deleteVersion(version.id)}
                                      disabled={deletingVersionIds[version.id]}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Delete
                                    </Button>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-slate-700">Revision Notes</p>
                        {record.revisionNotes.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">No revision notes available.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {record.revisionNotes.map((note) => (
                              <li key={note.id} className="rounded-md border border-slate-200 px-2 py-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <p className="text-xs font-semibold text-slate-800">{note.author?.fullName ?? "Reviewer"}</p>
                                  <Badge tone={note.isResolved ? "success" : "warning"}>{note.isResolved ? "Resolved" : "Open"}</Badge>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-700">{note.note}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(note.createdAt)}</p>
                                {canComment ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-1"
                                    onClick={() => void resolveComment(note.id, !note.isResolved)}
                                  >
                                    {note.isResolved ? "Reopen Note" : "Mark as Resolved"}
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {canComment ? (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={commentDrafts[record.id] ?? ""}
                          onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [record.id]: event.target.value }))}
                          placeholder="Add revision note"
                          className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                        />
                        <Button size="sm" variant="outline" onClick={() => void addComment(record.id)}>
                          Add Note
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations based on unresolved revisions, missing versions, and checklist completion status."
      />
    </div>
  );
};

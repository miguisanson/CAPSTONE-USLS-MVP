import { useEffect, useState } from "react";
import { documentsApi, studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import type { DocumentRecord, StudentListItem } from "../types/domain";
import { formatDateTime } from "../utils/format";

export const DocumentsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [checklistItem, setChecklistItem] = useState("Proposal Manuscript");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roles = user?.roles ?? [];
  const isStudent = roles.includes("STUDENT");
  const canCreateChecklist = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER"].includes(role)
  );
  const canUpload = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER", "STUDENT"].includes(
      role
    )
  );
  const canComment = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER", "PANEL_MEMBER"].includes(
      role
    )
  );

  const loadStudents = async () => {
    if (isStudent) {
      const me = await studentsApi.me();
      const studentRow: StudentListItem = {
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
      setStudents([studentRow]);
      setStudentId(me.id);
      return;
    }

    const response = await studentsApi.list({ pageSize: 50 });
    setStudents(response.items);
    if (!studentId && response.items.length > 0) {
      setStudentId(response.items[0]!.id);
    }
  };

  const loadDocuments = async (nextStudentId: number) => {
    const response = isStudent ? await documentsApi.my() : await documentsApi.byStudent(nextStudentId);
    setRecords(response);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await loadStudents();
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [isStudent]);

  useEffect(() => {
    const run = async () => {
      if (!studentId) return;
      try {
        setLoading(true);
        await loadDocuments(studentId);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [studentId]);

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

  const addComment = async (documentId: number) => {
    if (!comment.trim()) return;
    try {
      await documentsApi.addComment(documentId, { note: comment });
      setComment("");
      if (studentId) await loadDocuments(studentId);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <LoadingBlock text="Loading documents..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Document & Revision Management</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[240px_1fr_auto]">
          <select
            value={studentId ?? ""}
            onChange={(event) => setStudentId(Number(event.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {canCreateChecklist ? (
            <button
              onClick={() => void createRecord()}
              className="rounded-md bg-[var(--gs-primary)] px-3 py-2 text-sm text-white hover:bg-[var(--gs-dark)]"
            >
              Add Checklist Item
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {records.length === 0 ? (
          <EmptyState message="No document records for selected student." />
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{record.checklistItem}</p>
                    <p className="text-xs text-slate-500">
                      Status: {record.status} | Outstanding revisions: {record.outstandingRevisionCount}
                    </p>
                  </div>
                  {canUpload ? (
                    <label className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
                      Upload Version
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadVersion(record.id, file);
                          }
                        }}
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-500">Versions</p>
                    {record.versions.length === 0 ? (
                      <p className="text-xs text-slate-500">No uploaded versions.</p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {record.versions.map((version) => (
                          <li key={version.id} className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                v{version.versionNumber} - {version.fileName} ({formatDateTime(version.uploadedAt)})
                              </span>
                              <button
                                onClick={() => void downloadVersion(version.id, version.fileName)}
                                className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] hover:bg-white"
                              >
                                Download
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-500">Revision Notes</p>
                    {record.revisionNotes.length === 0 ? (
                      <p className="text-xs text-slate-500">No revision comments.</p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {record.revisionNotes.map((note) => (
                          <li key={note.id} className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">
                            {note.note} ({note.isResolved ? "Resolved" : "Open"})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {canComment ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add revision note"
                      className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => void addComment(record.id)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Add Note
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

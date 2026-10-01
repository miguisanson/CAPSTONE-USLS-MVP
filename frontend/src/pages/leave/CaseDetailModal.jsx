import { useEffect, useState } from "react";
import { api } from "../../api";
import { ErrorNote, Spinner } from "../../components/ui";
import { LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus";
import ModalShell from "./ModalShell";
import { ActionButton } from "./leaveUi";
import CaseConversation from "./CaseConversation";
import { CaseHistory, CaseSummary, ChecklistView, EarlierCases, FileList, FollowUpBlock, PolicyCheck, StudentSummary } from "./CaseSections";

/**
 * The full window for one request, the same in all four standalone processes: timeline, the
 * request, policy check, earlier requests, messages, files, Registrar follow-up and stage
 * history, with the steps as buttons at the bottom. It loads the full case itself and reloads whenever
 * `version` changes (the board bumps it after any step). Every button at the bottom
 * hands the action to `onAction`, which opens the same confirm box as "Move to...".
 */
export default function CaseDetailModal({ caseId, slug, vocabulary, version, onClose, onAction, onTransition, onNoteSent }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    api
      .processCase(slug, caseId)
      .then((res) => active && setLoaded(res.case))
      .catch((err) => active && setError(err.message || "This request could not be loaded."));
    return () => {
      active = false;
    };
  }, [slug, caseId, version]);

  const detail = loaded && loaded.id === caseId ? loaded : null;
  const actions = detail?.actions || [];

  return (
    <ModalShell
      id={`${slug}-case-${caseId}`}
      size="wide"
      title={detail ? detail.student.name : "Request details"}
      subtitle={detail ? `${detail.kind_label} · ${detail.student.student_number} · ${detail.student.program_code}` : "Loading the request..."}
      badge={detail ? leaveCaseStatusBadge(detail) : null}
      onClose={onClose}
      closeLabel="Close request details"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2">
            Close details
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            {detail && actions.length === 0 && (
              <p className="self-center text-sm text-slate-500">
                {detail.owner === "Dean"
                  ? "Waiting for the Dean."
                  : detail.owner === "Student"
                    ? "Waiting for the student."
                    : "No step is open right now."}
              </p>
            )}
            {actions.map((action) => (
              <ActionButton key={action.action} action={action} onClick={() => onAction(detail, action)} />
            ))}
          </div>
        </>
      }
    >
      {error && !detail && <ErrorNote message={error} />}
      {!detail && !error && <Spinner label="Loading the request..." />}
      {detail && (
        <div className="space-y-4">
          {error && <ErrorNote message={error} />}
          <LeaveTimeline steps={detail.timeline} />
          <CaseSummary item={detail} />
          <PolicyCheck detail={detail} />
          <ChecklistView detail={detail} />
          <div className="grid gap-4 lg:grid-cols-2">
            <StudentSummary detail={detail} />
            <EarlierCases detail={detail} />
          </div>
          <CaseConversation slug={slug} detail={detail} onTransition={onTransition} onNoteSent={onNoteSent} />
          <FileList files={detail.files} />
          <FollowUpBlock detail={detail} />
          <CaseHistory detail={detail} vocabulary={vocabulary} />
        </div>
      )}
    </ModalShell>
  );
}

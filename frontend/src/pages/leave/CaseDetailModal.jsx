import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { Button, InlineNotice, Modal, Spinner } from "../../components/ui/index.js";
import { RequirementBoxes } from "../../components/process";
import { LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus";
import { ActionButton } from "./leaveUi";
import CaseConversation from "./CaseConversation";
import { caseRequirements } from "./leaveHelpers";
import { CaseHeadline, CaseHistory, CaseSummary, ChecklistView, EarlierCases, FileList, FollowUpBlock, PolicyCheck, StudentSummary } from "./CaseSections";

/**
 * The full window for one request, the same in all four standalone processes: timeline, the
 * request, policy check, earlier requests, messages, files, Registrar follow-up and stage
 * history, with the steps as buttons at the bottom. It loads the full case itself and reloads whenever
 * `version` changes (the board bumps it after any step). Every button at the bottom
 * hands the action to `onAction`, which opens the same confirm box as "Move to...".
 */
export default function CaseDetailModal({ caseId, focus = "", slug, vocabulary, version, onClose, onAction, onNoteSent }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [edited, setEdited] = useState(0); // an edit in the window re-reads the request

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
  }, [slug, caseId, version, edited]);

  const detail = loaded && loaded.id === caseId ? loaded : null;
  const messagesRef = useRef(null);
  // The card's Message button opens the window on the note box.
  useEffect(() => {
    if (focus !== "messages" || !detail) return;
    const box = messagesRef.current?.querySelector("textarea");
    box?.scrollIntoView({ block: "center" });
    box?.focus({ preventScroll: true });
  }, [focus, Boolean(detail)]); // eslint-disable-line react-hooks/exhaustive-deps
  const requirements = detail ? caseRequirements(detail) : [];
  const actions = detail?.actions || [];

  return (
    <Modal
      size="lg"
      title={detail ? detail.student.name : "Request details"}
      subtitle={detail ? `${detail.kind_label} · ${detail.student.student_number} · ${detail.student.program_code}` : "Loading the request…"}
      badge={detail ? leaveCaseStatusBadge(detail) : null}
      onClose={onClose}
      closeLabel="Close request details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close details</Button>
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
        </>
      }
    >
      {error && !detail && <InlineNotice tone="danger">{error}</InlineNotice>}
      {!detail && !error && <Spinner label="Loading the request…" />}
      {detail && (
        <div className="space-y-4">
          {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          <CaseHeadline item={detail} />
          <LeaveTimeline steps={detail.timeline} />
          <CaseSummary item={detail} onEdited={() => setEdited((n) => n + 1)} />
          {requirements.length > 0 && <RequirementBoxes items={requirements} ariaLabel="Requirements for this request" className="" />}
          <PolicyCheck detail={detail} />
          <ChecklistView detail={detail} />
          <div className="grid gap-4 lg:grid-cols-2">
            <StudentSummary detail={detail} />
            <EarlierCases detail={detail} />
          </div>
          <div ref={messagesRef}>
            <CaseConversation slug={slug} detail={detail} onNoteSent={onNoteSent} onEdited={() => setEdited((n) => n + 1)} />
          </div>
          <FileList files={detail.files} />
          <FollowUpBlock detail={detail} />
          <CaseHistory detail={detail} vocabulary={vocabulary} />
        </div>
      )}
    </Modal>
  );
}

import { useEffect, useMemo, useState } from "react";
import { schedulingApi, studentsApi } from "../api/endpoints";
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
import type { Paginated, ScheduleRequestItem, StudentListItem } from "../types/domain";
import { diffDaysFromNow, formatDateTime, readableEnum } from "../utils/format";
import { scheduleStatusTone } from "../utils/presentation";

export const SchedulingPage = () => {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isStudent = roles.includes("STUDENT");
  const canSetScheduleOutcome = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"].includes(role)
  );

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [requests, setRequests] = useState<Paginated<ScheduleRequestItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requestStudentId, setRequestStudentId] = useState<number>(0);
  const [preferredDate, setPreferredDate] = useState("");
  const [requestReason, setRequestReason] = useState("Defense scheduling coordination");

  const [availabilityRequestId, setAvailabilityRequestId] = useState<number>(0);
  const [availabilityFrom, setAvailabilityFrom] = useState("");
  const [availabilityTo, setAvailabilityTo] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");

  const [eventRequestId, setEventRequestId] = useState<number>(0);
  const [eventStatus, setEventStatus] = useState("CONFIRMED");
  const [eventAt, setEventAt] = useState("");
  const [eventNotes, setEventNotes] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const requestRes = await schedulingApi.list({ pageSize: 60 });
      setRequests(requestRes);

      if (isStudent) {
        const me = await studentsApi.me();
        setStudents([
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
        ]);
        setRequestStudentId(me.id);
      } else {
        const studentsRes = await studentsApi.list({ pageSize: 100 });
        setStudents(studentsRes.items);
        setRequestStudentId((prev) => prev || studentsRes.items[0]?.id || 0);
      }

      setAvailabilityRequestId((prev) => prev || requestRes.items[0]?.id || 0);
      setEventRequestId((prev) => prev || requestRes.items[0]?.id || 0);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [isStudent]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const items = requests?.items ?? [];
    const actions: RecommendedActionItem[] = [];
    const pending = items.filter((item) => item.status === "REQUESTED");
    if (pending.length > 0) {
      actions.push({
        id: "pending-availability",
        title: "Collect availability for pending requests",
        description: `${pending.length} request(s) are still in requested state. Follow up with participants to avoid scheduling delays.`,
        priority: "high",
      });
    }
    const delayed = items.filter((item) => diffDaysFromNow(item.createdAt) > 10 && item.status !== "CONFIRMED");
    if (delayed.length > 0) {
      actions.push({
        id: "delayed-requests",
        title: "Escalate delayed scheduling cases",
        description: `${delayed.length} request(s) exceed 10 days without confirmed outcome.`,
        priority: "high",
      });
    }
    const rescheduled = items.filter((item) => item.status === "RESCHEDULED");
    if (rescheduled.length > 0) {
      actions.push({
        id: "rescheduled",
        title: "Review recurring reschedule patterns",
        description: `${rescheduled.length} request(s) have reschedule outcomes. Validate causes and improve lead-time planning.`,
        priority: "medium",
      });
    }
    return actions;
  }, [requests]);

  const createRequest = async () => {
    if (!requestStudentId) return;
    try {
      await schedulingApi.createRequest({
        studentId: requestStudentId,
        preferredDate: preferredDate || undefined,
        reason: requestReason || undefined,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const submitAvailability = async () => {
    if (!availabilityRequestId || !availabilityFrom || !availabilityTo) return;
    try {
      await schedulingApi.createAvailability({
        scheduleRequestId: availabilityRequestId,
        availableFrom: availabilityFrom,
        availableTo: availabilityTo,
        notes: availabilityNote || undefined,
      });
      setAvailabilityNote("");
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const submitEvent = async () => {
    if (!eventRequestId) return;
    try {
      await schedulingApi.createEvent({
        scheduleRequestId: eventRequestId,
        eventStatus,
        scheduledAt: eventAt || null,
        notes: eventNotes || undefined,
      });
      setEventNotes("");
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Scheduling" subtitle="Defense schedule requests, participant availability, and confirmed or rescheduled outcomes." />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="1. Create Schedule Request"
              subtitle="Start a defense scheduling workflow"
              insight={
                <QuickInsights
                  title="Schedule Request"
                  summary="Creates the initial request linked to a student case."
                  recommendation="Set preferred date and clear reason to streamline participant coordination."
                />
              }
            />
            <div className="space-y-2">
              <select
                value={requestStudentId}
                onChange={(event) => setRequestStudentId(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.studentNumber} - {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={preferredDate}
                onChange={(event) => setPreferredDate(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
              <input
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Reason"
              />
              <Button size="sm" onClick={() => void createRequest()}>
                Submit Request
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="2. Collect Availability"
              subtitle="Capture participant time slots"
              insight={
                <QuickInsights
                  title="Availability Collection"
                  summary="Participants submit available time windows per schedule request."
                  recommendation="Collect at least two slots per participant before finalizing outcomes."
                />
              }
            />
            <div className="space-y-2">
              <select
                value={availabilityRequestId}
                onChange={(event) => setAvailabilityRequestId(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              >
                {(requests?.items ?? []).map((request) => (
                  <option key={request.id} value={request.id}>
                    Request #{request.id}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={availabilityFrom}
                onChange={(event) => setAvailabilityFrom(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
              <input
                type="datetime-local"
                value={availabilityTo}
                onChange={(event) => setAvailabilityTo(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
              <input
                value={availabilityNote}
                onChange={(event) => setAvailabilityNote(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Notes"
              />
              <Button size="sm" variant="outline" onClick={() => void submitAvailability()}>
                Add Availability
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="3. Confirm / Reschedule / Cancel"
              subtitle="Record official schedule outcome"
              insight={
                <QuickInsights
                  title="Schedule Outcomes"
                  summary="Outcome updates set request status to confirmed, rescheduled, or cancelled."
                  recommendation="Only authorized staff should finalize outcomes after availability review."
                />
              }
            />
            {canSetScheduleOutcome ? (
              <div className="space-y-2">
                <select
                  value={eventRequestId}
                  onChange={(event) => setEventRequestId(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  {(requests?.items ?? []).map((request) => (
                    <option key={request.id} value={request.id}>
                      Request #{request.id}
                    </option>
                  ))}
                </select>
                <select
                  value={eventStatus}
                  onChange={(event) => setEventStatus(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <input
                  type="datetime-local"
                  value={eventAt}
                  onChange={(event) => setEventAt(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                <input
                  value={eventNotes}
                  onChange={(event) => setEventNotes(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Outcome notes"
                />
                <Button size="sm" variant="outline" onClick={() => void submitEvent()}>
                  Submit Outcome
                </Button>
              </div>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Schedule outcome updates are restricted to admin, staff, and coordinators.
              </p>
            )}
          </CardBody>
        </Card>
      </section>

      {loading ? <LoadingBlock text="Loading scheduling records..." /> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Scheduling Cases"
              subtitle="Status, availability, and event history by request"
              insight={
                <QuickInsights
                  title="Scheduling Case List"
                  summary="Each case includes request status, participant availability, and decision events."
                  recommendation="Monitor cases exceeding threshold days in requested/rescheduled states."
                />
              }
            />
            {!requests?.items.length ? (
              <EmptyState message="No scheduling cases available." />
            ) : (
              <div className="space-y-3">
                {requests.items.map((request) => (
                  <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Request #{request.id} - {request.student ? `${request.student.firstName} ${request.student.lastName}` : `Student #${request.studentId}`}
                        </p>
                        <p className="text-xs text-slate-600">
                          Created {formatDateTime(request.createdAt)} ({diffDaysFromNow(request.createdAt)} day(s) ago) | Preferred{" "}
                          {formatDateTime(request.preferredDate)}
                        </p>
                      </div>
                      <Badge tone={scheduleStatusTone(request.status)}>{readableEnum(request.status)}</Badge>
                    </div>

                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-slate-700">Availabilities</p>
                        {request.availabilities.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">No submitted availability yet.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {request.availabilities.map((slot) => (
                              <li key={slot.id} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">
                                {slot.user?.fullName ?? "Participant"}: {formatDateTime(slot.availableFrom)} - {formatDateTime(slot.availableTo)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-slate-700">Outcome History</p>
                        {request.scheduleEvents.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">No schedule outcomes recorded.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {request.scheduleEvents.map((event) => (
                              <li key={event.id} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">
                                {readableEnum(event.eventStatus)} | {formatDateTime(event.scheduledAt)} | {event.decidedBy?.fullName ?? "System"}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations based on pending scheduling cases, request aging, and outcome status trends."
      />
    </div>
  );
};

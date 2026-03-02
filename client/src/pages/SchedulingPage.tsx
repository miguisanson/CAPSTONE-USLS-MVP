import { useEffect, useState } from "react";
import { schedulingApi, studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import type { Paginated, ScheduleRequestItem, StudentListItem } from "../types/domain";
import { formatDateTime, readableEnum } from "../utils/format";

export const SchedulingPage = () => {
  const { user } = useAuth();
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
  const roles = user?.roles ?? [];
  const isStudent = roles.includes("STUDENT");
  const canSetScheduleOutcome = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"].includes(role)
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      const requestRes = await schedulingApi.list({ pageSize: 50 });
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
        const studentRes = await studentsApi.list({ pageSize: 50 });
        setStudents(studentRes.items);
        if (studentRes.items[0] && !requestStudentId) {
          setRequestStudentId(studentRes.items[0].id);
        }
      }

      setRequests(requestRes);
      if (requestRes.items[0]) {
        setAvailabilityRequestId(requestRes.items[0].id);
        setEventRequestId(requestRes.items[0].id);
      }
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [isStudent]);

  const createRequest = async () => {
    if (!requestStudentId) return;
    try {
      await schedulingApi.createRequest({
        studentId: requestStudentId,
        preferredDate: preferredDate || undefined,
        reason: requestReason || undefined,
      });
      await loadAll();
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
        notes: availabilityNote,
      });
      await loadAll();
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
        notes: eventNotes,
      });
      await loadAll();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <LoadingBlock text="Loading scheduling module..." />;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">1. Request Defense Schedule</h3>
          <div className="mt-2 space-y-2">
            <select
              value={requestStudentId}
              onChange={(event) => setRequestStudentId(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => void createRequest()}
              className="rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--gs-dark)]"
            >
              Submit Request
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">2. Collect Availability</h3>
          <div className="mt-2 space-y-2">
            <select
              value={availabilityRequestId}
              onChange={(event) => setAvailabilityRequestId(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={availabilityTo}
              onChange={(event) => setAvailabilityTo(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={availabilityNote}
              onChange={(event) => setAvailabilityNote(event.target.value)}
              placeholder="Availability note"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => void submitAvailability()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Add Availability
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">3. Confirm / Reschedule</h3>
          {canSetScheduleOutcome ? (
            <div className="mt-2 space-y-2">
              <select
                value={eventRequestId}
                onChange={(event) => setEventRequestId(Number(event.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CONFIRMED">Confirmed</option>
                <option value="RESCHEDULED">Rescheduled</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <input
                type="datetime-local"
                value={eventAt}
                onChange={(event) => setEventAt(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={eventNotes}
                onChange={(event) => setEventNotes(event.target.value)}
                placeholder="Outcome notes"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => void submitEvent()}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Submit Outcome
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Schedule outcome updates are restricted to staff/coordinators.</p>
          )}
        </div>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Scheduling Cases</h2>
        {!requests?.items.length ? (
          <EmptyState message="No scheduling cases available." />
        ) : (
          <div className="space-y-3">
            {requests.items.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-800">
                  Request #{request.id} - {request.student ? `${request.student.firstName} ${request.student.lastName}` : "Student"}
                </p>
                <p className="text-xs text-slate-500">
                  Status: {readableEnum(request.status)} | Preferred: {formatDateTime(request.preferredDate)}
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Availabilities</p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-700">
                      {request.availabilities.map((slot) => (
                        <li key={slot.id} className="rounded-md bg-slate-50 px-2 py-1">
                          {formatDateTime(slot.availableFrom)} - {formatDateTime(slot.availableTo)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Events</p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-700">
                      {request.scheduleEvents.map((event) => (
                        <li key={event.id} className="rounded-md bg-slate-50 px-2 py-1">
                          {readableEnum(event.eventStatus)} ({formatDateTime(event.createdAt)})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

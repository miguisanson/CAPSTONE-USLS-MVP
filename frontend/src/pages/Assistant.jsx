import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, User } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { PageHeader, SectionCard } from "../components/ui/index.js";
import StudentPicker from "../components/StudentPicker";
import AssistantChat from "../components/AssistantChat";
import { useAuth } from "../auth";
import { PAGE } from "../lib/labels.js";

// Staff and admin can focus the chat on a student record; every other signed-in
// role (Dean, coordinators, faculty) asks policy questions and questions about their own queue.
// The student portal uses this same page (`student`): it asks the student endpoints, about the student's own record.
export default function Assistant({ policyOnly: policyOnlyProp = false, student = false }) {
  const { user } = useAuth();
  const policyOnly = student || policyOnlyProp || !["staff", "admin"].includes(user?.role);
  const [searchParams] = useSearchParams();
  const initialStudentId = searchParams.get("student_id");
  const initialQuestion = searchParams.get("q") || "";
  const { data: meta } = useApi(() => (policyOnly ? Promise.resolve(null) : api.meta()), [policyOnly]);
  const [studentId, setStudentId] = useState(initialStudentId ? Number(initialStudentId) : null);
  const [studentLabel, setStudentLabel] = useState(searchParams.get("student_label") || "");

  const scope = student
    ? "Policy documents and your own record only"
    : policyOnly
    ? "Policy documents and your own queue"
    : studentId
      ? `Focused on ${studentLabel.split(" - ")[1] || "a student"}`
      : "General · policy documents and all students";
  const greeting = student
    ? "Hi! Ask about a procedure, a form, a deadline or your next step."
    : policyOnly
    ? "Hi! Ask what is waiting on you, or about a policy, form, procedure or deadline."
    : "Hi! Ask about a student's status, what is waiting on you, or a policy.";

  return (
    <div className="space-y-5 animate-fade-up">
      {/* CHANGED BY owner feedback 2026-11-23: no "How this works" card, no sample questions, no page subtitle. */}
      <PageHeader title={PAGE.assistant} icon={Bot} />

      <div className={policyOnly ? "" : "grid grid-cols-1 gap-5 lg:grid-cols-3"}>
        <div className={policyOnly ? "" : "lg:col-span-2"}>
          <AssistantChat
            ask={(question) => (student ? api.studentAssistant(question) : api.assistant(question, policyOnly ? null : studentId))}
            greeting={greeting}
            scope={scope}
            initialQuestion={initialQuestion}
            linkStudent={!policyOnly}
          />
        </div>

        {!policyOnly && (
          <div className="space-y-5">
            <SectionCard title="Focus on a student" icon={User}>
              <StudentPicker
                value={studentId}
                selectedLabel={studentLabel}
                meta={meta}
                onChange={(id, label) => {
                  setStudentId(id);
                  setStudentLabel(label || "");
                }}
              />
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}

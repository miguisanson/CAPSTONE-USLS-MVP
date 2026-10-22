import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, Info, User } from "lucide-react";
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
  const { data: suggData } = useApi(() => (student ? api.studentAssistantSuggestions() : api.assistantSuggestions()), [student]);
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
    ? "Hi! I'm the Policy Assistant. I answer from the Graduate School policy documents and the record connected to your account, and show the document, page and section behind every policy answer. Ask about a procedure, a form or a deadline, or what your next step is."
    : policyOnly
    ? "Hi! I'm the Policy Assistant. I answer from the Graduate School policy documents and show the document, page and section behind every answer. Ask what is waiting on you, or any question about policy, forms, procedures or deadlines."
    : "Hi! I'm the Policy Assistant. Ask about a student's status, what is waiting on you, or Graduate School policy. I answer from live records and the policy documents, and I say so when the documents do not cover a question.";

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={PAGE.assistant}
        icon={Bot}
        description="Answers come only from the uploaded policy documents and your own records, with the sources shown. For guidance only: final decisions stay with authorized personnel."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AssistantChat
            ask={(question) => (student ? api.studentAssistant(question) : api.assistant(question, policyOnly ? null : studentId))}
            greeting={greeting}
            suggestions={suggData?.items || []}
            scope={scope}
            initialQuestion={initialQuestion}
            linkStudent={!policyOnly}
          />
        </div>

        <div className="space-y-5">
          {!policyOnly && (
            <SectionCard title="Focus on a student" subtitle="Optional: ground answers in one record" icon={User}>
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
          )}

          <SectionCard title="How this works" icon={Info}>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Policy questions are answered only from the retrieved passages of the policy documents.</li>
              <li>Every answer lists its sources. Open one to see the document, page, section and exact passage.</li>
              <li>If the documents do not cover a question, it says so instead of guessing.</li>
              <li>Questions like &ldquo;what is my next step?&rdquo; use only your own record or queue.</li>
              <li>An &ldquo;Offline answer&rdquo; label means Gemini was not used and the answer is a keyword match.</li>
              {student && (
                <li>
                  Private and read-only: the assistant uses the record connected to your signed-in account. It cannot see other students
                  or change grades, enrollment, requests or official records.
                </li>
              )}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

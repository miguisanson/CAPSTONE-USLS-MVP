import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { api } from "../../api";
import { InlineNotice } from "../../components/ui/index.js";
import AssistantChat from "../../components/AssistantChat";

export function StudentPolicyAssistant() {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    api.studentAssistantSuggestions().then((response) => setSuggestions(response.items || [])).catch(() => setSuggestions([]));
  }, []);

  return (
    <div className="space-y-4">
      <InlineNotice tone="info" icon={Lock} title="Private and read-only">
        The assistant uses the approved policy documents and the record connected to your signed-in account. It cannot see other students
        or change grades, enrollment, requests or official records. If the documents do not cover your question, it says so.
      </InlineNotice>
      <AssistantChat
        ask={(question) => api.studentAssistant(question)}
        greeting="Hi! Ask me about the Graduate School handbook and procedures, or about your own record, for example what your next step is or what you are missing. I show the document and page behind every policy answer."
        suggestions={suggestions}
        scope="Policy documents and your own record only"
      />
    </div>
  );
}

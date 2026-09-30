import { useEffect, useState } from "react";
import {
  Lock,
  Send,
  Bot,
} from "lucide-react";
import { api } from "../../api";
import { Card, ErrorNote, SectionTitle } from "../../components/ui";
import { Field, Textarea } from "../../components/forms";

export function StudentPolicyAssistant() {
  const maxQuestionLength = 1500;
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.studentAssistantSuggestions().then((response) => setSuggestions(response.items || [])).catch(() => setSuggestions([]));
  }, []);

  async function ask(event) {
    event?.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError("Enter a question before sending.");
      return;
    }
    if (cleanQuestion.length > maxQuestionLength) {
      setError(`Keep your question under ${maxQuestionLength.toLocaleString()} characters.`);
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.studentAssistant(cleanQuestion));
    } catch (err) {
      setError(err.message || "The policy assistant could not answer right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-8">
        <SectionTitle title="Student Policy Assistant" subtitle="Ask about the Graduate School manual, student procedures, or your own academic record" icon={Bot} />
        <div className="mb-4 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-xs leading-relaxed text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p><span className="font-semibold text-ink">Private and read-only.</span> The assistant can use approved handbook content and the academic record connected to your signed-in account. It cannot see other students or change grades, enrollment, requests, or official records.</p>
        </div>
        <form onSubmit={ask} className="space-y-3">
          <Field label="Your question">
            <Textarea
              value={question}
              maxLength={maxQuestionLength}
              aria-describedby="student-assistant-character-count"
              onChange={(event) => {
                setQuestion(event.target.value);
                if (error) setError("");
              }}
              placeholder="What should I do next based on my record?"
            />
            <p id="student-assistant-character-count" className="mt-1 text-right text-xs text-slate-400">{question.length.toLocaleString()} / {maxQuestionLength.toLocaleString()}</p>
          </Field>
          <button type="submit" disabled={busy || !question.trim()} className="btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"><Send className="h-4 w-4" />{busy ? "Checking…" : "Ask assistant"}</button>
        </form>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        {result && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{result.answer}</p>
            {result.citations?.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Manual references</p><ul className="mt-2 space-y-2">{result.citations.map((item) => <li key={item.id} className="text-xs text-slate-600"><span className="font-semibold text-ink">{item.title}</span> · {item.source}</li>)}</ul></div>}
          </div>
        )}
      </Card>
      <Card className="p-5 lg:col-span-4">
        <h3 className="text-sm font-semibold text-ink">Suggested questions</h3>
        <div className="mt-3 space-y-2">{suggestions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => { setQuestion(item); setError(""); }} className="w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60">{item}</button>)}</div>
      </Card>
    </div>
  );
}

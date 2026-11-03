import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, InlineNotice, PageHeader } from "../components/ui/index.js";

// What the notice says, in plain words. The full text is GS-P-04 (Data Privacy Notice and Records Retention Schedule,
// Operations Manual 4.23); GS-F-45 is its paper twin.
const NOTICE = [
  ["What the platform keeps", "Your name, student number, program, standing and enrollment, the requests and forms you file with their attachments, messages about your cases, and an activity log of who did what and when."],
  ["Why", "To run the Graduate School processes you take part in (admission handoff, enrollment, leave, withdrawal, practicum, research defenses, graduation) and to report on them. Nothing here changes official grades or enrollment in AIMS."],
  ["Who sees it", "Graduate School staff, the coordinators and the Dean see the cases they handle. An adviser or panel member sees only the students assigned to that faculty member. A student sees only the student's own record."],
  ["What leaves the platform", "When the Policy Assistant or panel matching is switched on, the question, the matching policy passages and, for a personal question or panel matching, parts of the related records are sent to Google's service to prepare the answer. Section 5 of GS-P-04 lists each case."],
  ["How long it is kept", "Case files are kept 5 years after graduation or the last enrollment; the graduation list and the Registrar transmittals are kept permanently. GS-P-04 gives the full schedule."],
  ["Your rights", "Under the Data Privacy Act of 2012 (RA 10173) you may be informed, object, see and correct your data, have it blocked or removed, ask for a copy, claim damages, and file a complaint with the National Privacy Commission. Consent may be withdrawn in writing."],
  ["Questions", "Contact the Graduate School Office, which passes the request to the University's Data Protection Officer and answers in writing within fifteen working days."],
];

// First sign-in of an account that has not accepted the current notice version (GS-P-04): shown after the
// change-password step and before anything else. Built like ChangePassword (same card, header, buttons).
export default function PrivacyConsent() {
  const { user, refresh, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(event) {
    event.preventDefault();
    if (!agreed) {
      setError("Tick the box to confirm you have read the notice.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api.acceptPrivacyNotice();
      await refresh(); // the gate in App.jsx lets the page the person was on through
    } catch (err) {
      setError(err.message || "Could not record your acceptance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card pad="lg" as="section" className="w-full max-w-2xl" aria-labelledby="privacy-title">
        <PageHeader
          icon={ShieldCheck}
          title="Data Privacy Notice"
          titleProps={{ id: "privacy-title" }}
          description={`Please read this once before you continue (${user.privacy_notice_version}).`}
        />
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <dl className="space-y-3">
            {NOTICE.map(([term, text]) => (
              <div key={term}>
                <dt className="field-label">{term}</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{text}</dd>
              </div>
            ))}
          </dl>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 max-sm:min-h-11">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              aria-required="true"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            I have read the notice and agree that the Graduate School processes my personal data as described.
          </label>
          {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          <div className="flex flex-wrap justify-between gap-2 max-sm:flex-col-reverse">
            <Button variant="secondary" icon={LogOut} onClick={logout}>
              Sign out
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Saving…" : "Accept and continue"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}

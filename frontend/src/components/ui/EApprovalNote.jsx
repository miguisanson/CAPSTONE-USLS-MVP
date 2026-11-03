// EApprovalNote (FO7c): the one muted line under every approve / decide / endorse control. DecisionPanel shows it for
// you; use it directly for a control that is not a DecisionPanel (a faculty verdict, an accept button).
import { E_APPROVAL_NOTE } from "../../lib/formRefs.js";

export function EApprovalNote({ className = "" }) {
  return <p data-slot="e-approval-note" className={`meta ${className}`.trim()}>{E_APPROVAL_NOTE}</p>;
}

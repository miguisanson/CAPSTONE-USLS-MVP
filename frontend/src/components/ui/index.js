// The local component library (UI-SPEC section 4). Every component is imported from here:
//   import { Button, Card, StatusChip } from "../components/ui/index.js";
// P1a ships these as empty stubs; P1b-P1f fill them in. Note: `components/ui.jsx` (the old single file) still
// exists next to this folder, and `import ".../components/ui"` resolves to that FILE first. Import this index as
// ".../components/ui/index.js" until the last packet deletes ui.jsx and the shims.
export * from "./Button.jsx";
export * from "./Card.jsx";
export * from "./Field.jsx";
export * from "./StatusChip.jsx";
export * from "./Modal.jsx";
export * from "./DataTable.jsx";
export * from "./Feedback.jsx";
export * from "./PageHeader.jsx";
export * from "./StatCard.jsx";
export * from "./Stepper.jsx";
export * from "./DecisionPanel.jsx";
export * from "./HistoryPanel.jsx";

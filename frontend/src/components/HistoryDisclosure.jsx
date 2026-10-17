import { HistoryPanel } from "./ui/HistoryPanel.jsx";

// The free-content disclosure used on many pages ("View logs" with whatever the caller puts under it).
// It is now HistoryPanel with `children`: same props, same toggle look. Pages that have a plain list of history
// entries pass them to HistoryPanel `entries` instead.
export default function HistoryDisclosure({
  label = "View logs",
  hideLabel = "Hide logs",
  count,
  children,
  className = "",
  contentClassName = "mt-3",
  defaultOpen = false,
}) {
  return (
    <HistoryPanel
      label={label}
      hideLabel={hideLabel}
      count={count}
      className={className}
      contentClassName={contentClassName}
      defaultOpen={defaultOpen}
    >
      {children}
    </HistoryPanel>
  );
}

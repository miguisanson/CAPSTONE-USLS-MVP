import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Filter state for a board that can open on its open requests (the address ?show=open, the dashboard's task links, I-198).
// `base` is the board's empty filters; clearing the "Open requests only" chip drops the parameter from the address again.
export function useOpenFilters(base) {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ ...base, open: params.get("show") === "open" }));
  useEffect(() => {
    if (filters.open || params.get("show") !== "open") return;
    const next = new URLSearchParams(params);
    next.delete("show");
    setParams(next, { replace: true });
  }, [filters.open]); // eslint-disable-line react-hooks/exhaustive-deps
  return [filters, setFilters];
}

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

// Minimal data-fetching hook with loading/error/refetch.
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(() => {
    let active = true;
    setLoading(true);
    setError("");
    fn()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err.message || "Something went wrong."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { data, loading, error, refetch: run };
}

// True below Tailwind's `sm` (640 px): the width where the layout switches to its phone form.
const PHONE = "(max-width: 639px)";
const subscribePhone = (notify) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
export const useIsPhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);

// The name of the record a page is about ("Lorenzo Reyes · Leave of Absence"), for the breadcrumb's last part and the tab
// title (I-196). A record page that is not in the sidebar calls useRecordTitle(name); Layout shows it. Without a name the
// breadcrumb falls back to the generic RECORD_LABELS word ("Case", "Student Record").
import { createContext, useContext, useEffect } from "react";

const RecordTitleContext = createContext(() => {});
export const RecordTitleProvider = RecordTitleContext.Provider;

export function useRecordTitle(title) {
  const setTitle = useContext(RecordTitleContext);
  useEffect(() => {
    if (!title) return undefined;
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);
}

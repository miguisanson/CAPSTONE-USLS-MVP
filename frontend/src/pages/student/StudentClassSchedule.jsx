import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { api } from "../../api";
import { Field, InlineNotice, PageHeader, SectionCard, Select, Spinner } from "../../components/ui/index.js";
import { PublishedClasses } from "../faculty/FacultySchedule";

export default function StudentClassSchedule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const termId = searchParams.get("term_id") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    api.studentClassSchedule({ term_id: termId || undefined }).then((response) => { if (active) setData(response); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [termId]);
  return <div className="page-stack"><PageHeader title="Schedule" icon={CalendarDays} description="Published class meeting times for your recorded subjects. Where a subject has several sections, confirm your section with the Academic Coordinator." />
    {error && <InlineNotice tone="danger" title="Could not load your class schedule">{error}</InlineNotice>}
    {loading ? <Spinner label="Loading class schedule…" /> : data && <SectionCard title="My published classes"><Field label="Semester"><Select aria-label="Class schedule semester" placeholder={null} value={String(data.term?.id || termId)} onChange={(event) => { const params = new URLSearchParams(searchParams); params.set("term_id", event.target.value); setSearchParams(params, { replace: true }); }} options={(data.terms || []).map((term) => ({ value: term.id, label: term.label }))} /></Field><PublishedClasses sections={data.sections} /></SectionCard>}
  </div>;
}

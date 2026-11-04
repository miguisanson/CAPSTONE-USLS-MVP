import { useEffect, useState } from "react";
import { api } from "../../api";
import { Select } from "../ui/index.js";
import { ayEntryOptions } from "./knownData";

/**
 * "School year / AY entry" pick: replaces the typed box so the format can never be wrong. The years come from every
 * configured semester (read here), the labels the page already has (`termLabels`) and the school years of the students
 * the page lists (`studentValues`; none given = 8 years back from the oldest semester).
 */
export default function AyEntrySelect({ value, onChange, termLabels = [], studentValues = [], ...rest }) {
  const [allTerms, setAllTerms] = useState([]);
  useEffect(() => {
    let active = true;
    api.adminTerms().then((res) => active && setAllTerms((res.items || []).map((t) => t.label))).catch(() => {}); // other roles: the page's own labels
    return () => { active = false; };
  }, []);
  return <Select {...rest} value={value} onChange={onChange} options={ayEntryOptions([...termLabels, ...allTerms], studentValues, value)} placeholder="Choose school year" />;
}

// The spoken lines of the recorded demo (scripts/demo/narration.json), looked up by the key a guide step names.
import narration from "../../../../scripts/demo/narration.json";

/** The line for a key, or "" when there is none or the line is empty. */
export const sayLine = (key) => (key && typeof narration[key] === "string" ? narration[key] : "");

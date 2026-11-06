// Which program level a student is in, and which business rules belong to it (I-416).
// Mirrors the server's residence_limits(); a rule is scoped by its title ("Master's: ..." / "Doctorate: ...").

export function programLevelOf(student) {
  if (!student) return "";
  if (student.program_level) return student.program_level;
  const name = String(student.program_name || "").toLowerCase();
  const code = String(student.program_code || "").toUpperCase();
  return name.includes("doctor") || name.includes("phd") || ["DBA", "EDD", "PHD"].includes(code) ? "Doctorate" : "Master's";
}

const scopeOf = (rule) => /^(Master's|Doctorate)\b/.exec(rule.title || "")?.[1] || "";

/** { mine, others }: general rules and the student's level first; the other level's rules apart. */
export function splitRulesByProgram(rules, level) {
  const mine = [];
  const others = [];
  for (const rule of rules) (level && scopeOf(rule) && scopeOf(rule) !== level ? others : mine).push(rule);
  return { mine, others };
}

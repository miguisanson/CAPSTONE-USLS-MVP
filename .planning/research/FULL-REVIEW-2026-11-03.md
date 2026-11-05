# Full review before UAT (Fable) — v6.1-migui @ d578768, 2026-11-03

One-time read-only review by Fable (3 Sonnet audits + 1 UX audit + own probes on a fresh seed; scripts in
`E:/Temp/claude/fable/`). Findings filed as I-209..I-217 (F-26 closed I-188; F-20 was stale ISSUES statuses — the
pkt/logic2 rows are now marked fixed). (ran) = executed, (read) = code read.

## Verdict
1. Every role's main flow ran end to end; 8 threads x 84 mixed requests gave 0 server errors; anonymous/IDOR/traversal
   probes refused; headline report numbers match recomputation.
2. Blocker for a public site: public repo + shared demo password on all 156 seeded accounts incl. admin; re-seed
   restores it; DEMO_SHOW_ACCOUNTS=0 only hides the panel (F-01 -> I-209).
3. Research Coordinator 403 on /api/faculty (F-02 = I-201); admin cannot move Withdrawal/AWOL cards (F-03 -> I-210).
4. Reports numbers right, two tiles say false things (F-07, F-08).
5. Phones: tester cannot see which role they are; dialogs show raw slugs and "User #12".

## Findings
P1: F-01 public shared password (fix: `DEMO_PASSWORD` env override in the seed + Cloudflare Access, re-seed with it);
F-02 `/api/faculty` add research_coordinator (app.py ~15332); F-03 `standalone_process.actor_key` admin->staff;
F-04 401 -> sign-in redirect, network-error text (`api.js:11-18`); F-05 name/role + "Sign out" in the phone drawer
(`Layout.jsx:281-287`); F-06 hide Change password for seeded demo accounts in DEMO_MODE (or tell testers).
P2: F-07 "no decisions in <prev>" when either side empty (app.py ~25461); F-08 "Graduation-ready" = endorsements sent
(~25499); F-09 Defenses/Graduation tile headline != drill-down (~25485, ~25505); F-10 at-risk scopes 24 vs 30 vs 30;
F-11 raw slugs/User # in Dean dialogs (`DeanParts.jsx:129-142`), "Prototype rule" badges (`business_rules_catalog.py:24`);
F-12 Gemini path cites all retrieved chunks (`_policy_citation` ~11321, `AssistantSources.jsx:34`); F-13 no injection
delimiters/systemInstruction (~11297-11316), regex blocklist gaps (~12254); F-14 keyless fallback presents rare-word
hits as answers, "drop a class"/"drop MATH 501" still miss withdrawal (`policy_rag.py:606`); F-15 panel matching calls
Gemini on every view, no cache (~25989, 26009, 29213, 33234), test-question unmetered, 3-attempt loop ~100 s (~10463);
F-16 any faculty reads any course roster (~18099); F-17 ~20 handlers return str(exc); CSV exports not formula-escaped
(~14292-14310); F-18 Dean sticky footer 1/3 of phone with keyboard, "Move to…" 26 px, backdrop click loses a typed
reason (`ui/Modal.jsx`); F-19 "AC" jargon, "recorded transactions", "(Student) (Student)"; F-20 (stale statuses).
P3: F-21 Research Protocol citations have no page; F-22 ProxyFix x_host=0 (`serve_uat.py:60`), no HSTS/CSP; F-23 faculty
can read other faculty .ics, staff-set faculty passwords never force a change; F-24 raw toLocaleString dates in 7 files,
"Open" chip green, four words for one red outcome; F-25 seed oddities (34 research students with no adviser, every open
case 13-83 days old, Hector Ong/Isabel Flores "Completed" while endorsements await the Dean); F-27 confirm the UAT seed
has no e2e personas ("Spec leave banner" seen in e2e shots).
Policy questions (ask, do not build): I-167, I-170, I-174.

## Do before Wednesday (Fable's order)
1 F-01 + Cloudflare Access; 2 F-02; 3 F-03; 4 F-04 + F-05; 5 F-06; 6 F-07 + F-08; 7 F-11; 8 F-18; 9 F-16 + F-22;
10 Wednesday: `npm run build:web`, `npm run seed` (with DEMO_PASSWORD), `npm run uat`, check /api/health from a phone;
tell testers the withdrawal window closes 2026-11-15 on a 11-04 seed.

## Not checked
Real Gemini; real Cloudflare headers; keyboard/contrast in a browser; 390 px shots after d6544f0/9e17970; Google
Calendar end to end; concurrent writes beyond notifications; Playwright on this HEAD; full Handbook re-audit.

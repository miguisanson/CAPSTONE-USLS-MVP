# UX research for the USLS Graduate School portal (checks, with sources)

Researched 2026-10-22. Complements `.planning/research/REFERENCE-PORTALS.md` (not repeated here).
Every rule below was read on the cited page unless marked *(inferred)*. Gaps are listed at the end.

---

## 1. Kanban / process boards

1. **Every board has a menu path to move a card; drag is never the only way.** WCAG 2.5.7 (AA) lists "Kanban board: select a card with one tap or click, then press an arrow button" and "task board: pick a target column from a pop-up menu" as passing. Keyboard drag alone does NOT satisfy it (keyboard and single-pointer are judged separately). Check: each card has a "Move to..." menu that lists only legal next stages.
   - https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
   - https://www.w3.org/WAI/WCAG22/Techniques/failures/F108.html (uses a Kanban board as the failure example)
2. **If dnd-kit is used, its keyboard sensor is on and the announcements are set.** Space/Enter picks up and drops, arrows move, Escape cancels; the context renders hidden instructions and a live region that announces start/over/end/cancel. Check: the defaults are not disabled, and the English-only text is replaced with plain wording ("Moved Case 12 to Dean review, position 2 of 5").
   - https://dndkit.com/guides/accessibility
   - https://dndkit.com/api-documentation/sensors/keyboard
3. **Aging is visible on the card, not only inside the detail page.** Kanban Zone: three aging levels per board (defaults 7, 14, 21 days), the card colour shifts gradually, and the clock restarts only when the card changes column or is edited (moving within the same column does not count). Jira users filed requests because the default "days in column" is too subtle: make the indicator solid and per-stage. Check: each stage has its own threshold and the card shows "5 days here" in text plus a colour/icon.
   - https://kanbanzone.com/2020/card-aging-fun-and-helpful-visual-signal-for-kanban/
   - https://jira.atlassian.com/browse/JSWSERVER-15135
   - https://jira.atlassian.com/browse/JSWSERVER-11704
4. **Blocked / waiting cards carry their own signal in addition to aging.** Kanban Zone shows a red block marker combined with the aging colour; Jira's "flag" adds an icon and tints the card, and teams add a swimlane that queries flagged cards (community reports, not official docs). Check: "Waiting on student" cards show an icon + text, not colour alone.
   - https://kanbanzone.com/2020/card-aging-fun-and-helpful-visual-signal-for-kanban/
   - https://community.atlassian.com/forums/Jira-questions/How-can-we-implement-WIP-limits-at-a-Swimlane-level-in-a-column/qaa-p/1177072
5. **A locked / "cannot start yet" card says why and is not a link.** GOV.UK task list: "Cannot start yet" is grey text with no background, the row is not linked, and a hint explains when it becomes available. Check: a locked board card has a lock icon + one-line reason ("Needs adviser sign-off") and no drag handle; the "Move to..." menu omits illegal stages.
   - https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
6. **Status chips on cards use one shared map and short sentence-case adjectives.** See topic 5.
   - https://design-system.service.gov.uk/components/tag/
7. **Board has a table view of the same data, and filters are shown as removable tags with an explicit Apply and Clear.** MoJ filter pattern: selected filters appear as removable tags under a "Selected filters" heading, filters apply on a button press (not on every tick), a "Clear filters" link sits beside the heading, and on mobile the filter panel starts hidden behind a "Show filter" toggle. (Board-vs-table toggle itself is not documented by these sources; it follows from the tabular alternative that screen reader and mobile users need *(inferred)*.)
   - https://design-patterns.service.justice.gov.uk/patterns/filter-a-list/
8. **Bulk actions appear only after selection, in a bar that replaces row actions.** Carbon: batch action bar shows once an item is selected, single-row action icons are disabled during batch mode, header checkbox has an indeterminate state. Check: on a list or board column view, "Select N" reveals "Approve / Return / Assign" and the row menus go inert.
   - https://www.carbondesignsystem.com/components/data-table/usage/
9. **Aging/WIP: keep WIP limits as a count badge in the column header only if staff can act on it.** Sources found describe WIP limits only in vendor/community pages (not verified); for a thesis demo prefer per-stage aging (rule 3) over WIP limits. *(opinion)*
   - https://www.atlassian.com/agile/kanban/wip-limits (page text did not load; unverified)

---

## 2. Role dashboards / home pages

1. **One screen, one job: the home page answers "what must I do now?".** NN/g: a dashboard communicates critical information at a glance, supports one task, and stays on a single screen; operational dashboards support immediate action.
   - https://www.nngroup.com/articles/dashboards-preattentive/
2. **Order by importance: action list first, numbers second.** Carbon: rank by importance, most important top, largest area and highest contrast; show only essential KPIs tied to the problem and remove anything that distracts.
   - https://www.carbondesignsystem.com/data-visualization/dashboards/
3. **Shopify's home pattern is the closest published model:** home surfaces "performance metrics, items needing attention, and onboarding guidance"; a list of "things needing attention" sits beside a small metrics group (the example uses three metrics); only one banner is visible at a time; dismissals are persisted. Check: each role home has at most 3-4 number tiles and one attention list.
   - https://shopify.dev/docs/api/app-home/patterns/templates/homepage
4. **Every number tile is a link into the filtered list it counts.** *(inferred from Shopify "card = section with action in header" and Slate-style bins in REFERENCE-PORTALS)* Check: clicking "7 awaiting your decision" opens the list pre-filtered to those 7, and the counts match.
   - https://shopify.dev/docs/api/app-home/patterns/templates/homepage
5. **Use bar/line/linear charts, never pie/donut/radar/gauge for quantities; sort bars by value; no 3D; colour is not magnitude.** If a chart does not change a decision for that role, drop it.
   - https://www.nngroup.com/articles/dashboards-preattentive/
6. **Same colour = same dataset on every chart; legends in the same place.**
   - https://www.carbondesignsystem.com/data-visualization/dashboards/
7. **The attention list shows who, what, how long, and next action per row** (student, request type, days waiting, button "Review"). Row = single clear action; the Review button is a verb. *(inferred from GOV.UK button + Vanderbilt Action List in REFERENCE-PORTALS)*
   - https://design-system.service.gov.uk/components/button/
8. **Banners/notifications: max one per page, success banner removed on navigation, not used for validation errors.**
   - https://design-system.service.gov.uk/components/notification-banner/
9. **Empty attention list is a positive empty state** ("Nothing needs your action. Next defense: 12 Nov"). Carbon: user-action empty states can confirm completion; no dead ends.
   - https://www.carbondesignsystem.com/patterns/empty-states-pattern/

---

## 3. Multi-step request forms

1. **Validate on submit/Continue, not on blur or while typing.** GOV.UK: "Do not validate when the user moves away from a field"; always validate on the server too; do not rely on HTML5 `required` (use `novalidate`).
   - https://design-system.service.gov.uk/patterns/validation/
2. **Error summary at top, titled "There is a problem", focus moved to it, each item links to its field.** Same wording as the inline message. Links: text input -> that input; radios/checkboxes -> first option; date -> first field with error. Show it even for a single error.
   - https://design-system.service.gov.uk/components/error-summary/
3. **Page `<title>` starts with "Error: "** on a failed submit; keep the user's answers in the fields (never clear them).
   - https://design-system.service.gov.uk/patterns/validation/
   - https://design-system.service.gov.uk/components/error-message/
4. **Error text says what is wrong and how to fix it:** "Enter the reason for your leave of absence"; "Start date must be in the future". Avoid "invalid", "please", "This field is required". Inline message sits between hint and input, red text + red border + visually hidden "Error:" prefix.
   - https://design-system.service.gov.uk/components/error-message/
   - WCAG 3.3.1/3.3.3: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
5. **Mark optional fields "(optional)"; never asterisks.** Ask only what you need, say why, ask each thing once.
   - https://design-system.service.gov.uk/patterns/question-pages/
6. **Never ask the student to retype data the system already holds** (name, student number, program, adviser). WCAG 3.3.7 (Level A): auto-populate or let them select earlier entries within one process.
   - https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
7. **Check-your-answers step before submit:** Change link beside each answer with hidden text naming the field; Change returns to the summary; submit button names the action ("Submit leave request"); state that nothing is sent until confirmed; unanswered optional items show "Not provided".
   - https://design-system.service.gov.uk/patterns/check-answers/
8. **File uploads: visible label, one specific error per case, limits stated.** Messages: "Select a [item]", "The selected file must be a PDF or DOCX", "The selected file must be smaller than 10MB", "The selected file is empty", "could not be uploaded - try again". Keep `accept`; don't use `required`; link error via `aria-describedby`; allow reuse of a file already uploaded in the journey.
   - https://design-system.service.gov.uk/components/file-upload/
9. **Long requests are a task list with a status per section and saved progress:** statuses Not yet started / In progress / Completed / Cannot start yet; end optional or long sections with "Have you completed this section?"; show the list again at the start of every returning session; allow any order unless a dependency exists.
   - https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
10. **Confirmation page:** reference number, what happens next and when, contact details, a way to save a record (PDF), link to track the request; keep the page reachable (bookmark). Use a success banner instead only when the user is mid-journey.
    - https://design-system.service.gov.uk/patterns/confirmation-pages/
    - https://design-system.service.gov.uk/components/notification-banner/
11. **Irreversible actions (submit decision, withdraw, delete) get a confirm step** with a static heading and the key details of the item shown in a summary list; after the action show a banner saying what happened.
    - https://design-patterns.service.justice.gov.uk/patterns/confirm-an-action/
12. **One primary button per page; avoid disabled buttons; guard against double submit on the server.**
    - https://design-system.service.gov.uk/components/button/

---

## 4. Data tables

1. **Native `<table>` with `<caption>`, `<th scope="col|row">`, numbers right-aligned.**
   - https://design-system.service.gov.uk/components/table/
2. **Density is a user-visible setting or at least one consistent size; header row height equals body row height.** Carbon sizes: xs 24, sm 32, md 40 (default), lg 48, xl 64 px; use xl only for two-line rows. For touch-friendly rows use 40-48.
   - https://www.carbondesignsystem.com/components/data-table/usage/
3. **First column is a human-readable identifier** (student name + number), not a database id; related columns adjacent; order columns by importance.
   - https://www.nngroup.com/articles/data-tables/
4. **Freeze the header row (and first column when wide); a subtle shadow shows it floats.** Sticky header must not hide focused rows (WCAG 2.4.11: fix with `scroll-padding-top`).
   - https://www.nngroup.com/articles/data-tables/
   - https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
5. **Sort from the column header; only the sorted column shows an arrow; expose sort state to AT (`aria-sort`).** *(aria-sort is inferred, not on the cited page)*
   - https://www.carbondesignsystem.com/components/data-table/usage/
6. **Pagination, not infinite scroll** (infinite scroll hurts keyboard users). Hide pagination when one page; put "page 2 of 7" in `<title>`; filters/sort apply to the whole list and return to page 1; collapse to first/prev/current/next/last on small screens.
   - https://design-system.service.gov.uk/components/pagination/
7. **Row actions: fewer than three -> inline buttons, otherwise an overflow menu; overflow stays visible on touch.** Row action text names the row ("Review - Maria Santos") for screen readers *(inferred)*.
   - https://www.carbondesignsystem.com/components/data-table/usage/
8. **Show active filters as removable tags with a clear-all.**
   - https://design-patterns.service.justice.gov.uk/patterns/filter-a-list/
   - https://www.nngroup.com/articles/data-tables/ (clear indicator that filters are active)
9. **Empty state replaces the whole table (headers too):** no data -> what will appear and how to add; no results -> why and how to adjust filters; error -> what to do. Short positive title, one CTA, no dead end.
   - https://www.carbondesignsystem.com/patterns/empty-states-pattern/
10. **Mobile at 390px: either a labelled scroll region or cards, never a clipped table.** Scroll region = wrapper with `tabindex="0"`, `role="region"`, `aria-labelledby` the caption, `overflow:auto`, visible focus; do not set `display:block` on the table. WCAG 1.4.10: data tables may scroll in two dimensions, but search, filters and pagination around them must reflow at 320px.
    - https://adrianroselli.com/2020/11/under-engineered-responsive-tables.html
    - https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
11. **Record detail uses a key-value summary list, not a table.** Cards only for several items of one type; max 2-3 short card actions; hard-to-undo card actions get a confirm.
    - https://design-system.service.gov.uk/components/summary-list/

---

## 5. Status communication

1. **One status-to-colour map, same colour for the same status everywhere.** Start with the fewest statuses; add more only when users need to tell them apart.
   - https://design-system.service.gov.uk/components/tag/
2. **Semantic colours:** red = danger/error, orange = serious warning, yellow = warning, green = success, blue = in progress/passive, grey = draft/not started, purple = undefined. Show the highest-attention colour when a row aggregates several. Skip an indicator when no action is needed (use plain text).
   - https://www.carbondesignsystem.com/patterns/status-indicator-pattern/
3. **Colour never carries meaning alone:** at least two of colour/shape/symbol plus text; 3:1 contrast between indicator and background; must still read in grayscale. (WCAG 1.4.1, 1.4.11.)
   - https://www.carbondesignsystem.com/patterns/status-indicator-pattern/
   - https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
4. **Chips are non-interactive, sentence case, adjectives not verbs** ("Awaiting dean", not "Approve"). Do not make a chip a link or button. Keep labels short (truncated chips cannot be read by AT users).
   - https://design-system.service.gov.uk/components/tag/
   - https://atlassian.design/components/lozenge/usage
5. **Use red only for errors/rejections;** "Cannot start yet" is grey text, "Completed" can be plain text so items needing action stand out.
   - https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
6. **Timeline entries show: short title, date (and time if known), who/what made the change (byline), optional one-line detail; newest first.** Never show a fake midnight time.
   - https://design-patterns.service.justice.gov.uk/components/timeline/
7. **Stepper/process path marks the current step, uses success/pending/warning/danger variants and gives icons accessible labels.**
   - https://www.patternfly.org/components/progress-stepper (cited in REFERENCE-PORTALS)
8. **"Waiting on whom" wording:** name the role and, where allowed, the person, plus how long: "Waiting on: Program Chair (since 14 Oct, 8 days)". Pair with the next step: "Next: Dean decision". *(inferred from timeline byline + task-list "hint explains when it becomes available"; no source defines this phrase)*
   - https://design-patterns.service.justice.gov.uk/components/timeline/
   - https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
9. **A decision ends with a visible outcome and a "Return" shows the comment and what the student must change.** *(inferred from Vanderbilt Approve/Deny/Send back in REFERENCE-PORTALS)*

---

## 6. RAG policy-assistant chatbot

1. **Say what it can answer at the start, tailored to the page, and don't overpromise.** NN/g guideline 3; PAIR: state limits up front, don't present AI as all-knowing, note it can make mistakes.
   - https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
   - https://pair.withgoogle.com/chapter/mental-models/
2. **Suggested questions are clickable buttons, shown on open and again after answers, concrete and not repetitive.** Curate by hand; place next to the input.
   - https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
   - https://www.nngroup.com/articles/designing-use-case-prompt-suggestions/
3. **Every claim carries a citation to a named source passage** (document title + section/page), not a bare URL; the citation maps to the text span it supports. Gemini returns per-span annotations (`url`, `title`, `start_index`, `end_index`) that make this possible. Research (AAAI 2025) found citations raise trust even when random and lower it when users check them, so cite only what the model really used and make verification one click.
   - https://ai.google.dev/gemini-api/docs/google-search (annotation mechanics; this page documents Google Search grounding, verify the field names for your own grounding setup)
   - https://ojs.aaai.org/index.php/AAAI/article/view/34550
3a. **Show the exact quoted passage in a side panel or expandable row**, so the panel can see the handbook text without leaving. *(inferred)*
4. **"I don't know" answer is specific and gives a way forward:** state what could not be found, offer related topics or the handbook section index, and a human contact (GS office). PAIR: don't guess silently at low confidence; hand control back to the user; no vague "No results".
   - https://pair.withgoogle.com/chapter/errors-failing/
5. **Offer a non-AI fallback** (link to the policy document list or contact the GS office).
   - https://pair.withgoogle.com/chapter/mental-models/
6. **Feedback: thumbs up/down on each answer, optional "what was wrong" reason, and say what happens with it.** Tell users what you log.
   - https://pair.withgoogle.com/chapter/feedback-controls/
7. **Do not autoscroll while streaming;** keep the reader at the top of the new answer. Use progressive disclosure for long policy text. Let users save/copy a chat and resize the window.
   - https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
8. **Chatbot entry point sits in the same place on every page** (WCAG 3.2.6 Consistent Help, Level A) and the bot self-identifies as an automated assistant.
   - https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html
   - https://www.nngroup.com/articles/ai-chatbots-design-guidelines/ (guidelines 1-2)
9. **Announce status, not tokens, to screen readers:** `role="status"` for "Searching handbook..." / "Answer ready"; do not live-announce every streamed token.
   - https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html (streaming guidance is an inference)
10. **Disclaimer is short and sits near the input, not buried:** "Answers come from the Graduate School Handbook; check the cited section. Not an official ruling." Don't use first-person "I" in a way that implies human understanding.
    - https://pair.withgoogle.com/chapter/mental-models/ *(wording is ours)*
11. **Wording from Microsoft's HAI guidelines to test against:** explain what it can do (1), how well (2), clarify scope when unsure of the goal (10), explain why it answered that way (11), easy to dismiss (8).
    - https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/

---

## 7. WCAG 2.2 AA failures common in React/Tailwind admin apps

Most frequent real-world failures (WebAIM Million, 2026 home pages): low-contrast text 83.9%, missing alt 53.1%, **missing form labels 51%**, empty links 46.3%, empty buttons 30.6%, missing document language 13.5%. https://webaim.org/projects/million/

1. **Focus is always visible.** Tailwind `outline-none` removes the outline even in forced-colors mode; use `focus-visible:outline-2 focus-visible:outline-offset-2 ...` or `outline-hidden` plus a ring. Indicator needs 3:1 against adjacent colours (SC 2.4.7, 1.4.11). Grep for `outline-none` and `focus:ring-0` without a replacement.
   - https://tailwindcss.com/docs/outline-style
   - https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
2. **Pointer targets are at least 24x24 CSS px (SC 2.5.8)** or have 24px of clear spacing: watch icon buttons (`h-5 w-5` with no padding), table row action icons, chip close buttons, pagination arrows, kanban card menus. Zoom does not fix it; inline text links are exempt.
   - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
3. **Sticky header/footer never fully hides the focused element (SC 2.4.11).** Add `scroll-padding-top` equal to header height; cookie banners and the chatbot launcher must not cover form buttons.
   - https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
4. **Dialogs:** focus moves in on open; Tab/Shift+Tab cycle inside; Escape closes; focus returns to the opener; `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; for destructive dialogs focus the least destructive button; visible Close/Cancel. Prefer a tested primitive (Radix/Headless UI/`<dialog>`) over hand-rolled.
   - https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
5. **Every input has a programmatic label** (`<label for>` or `aria-labelledby`); placeholder is not a label; errors linked via `aria-describedby`; icon-only buttons have `aria-label`.
   - https://webaim.org/projects/million/
   - https://design-system.service.gov.uk/components/file-upload/
6. **Contrast:** text 4.5:1 (3:1 large); input borders, checkbox edges, focus rings and meaningful icons 3:1 (a `#AAA` border on white fails; `#767676` passes). Tailwind `gray-400` borders and `gray-400` placeholder text are the usual offenders; check the green brand on white and white-on-green buttons, and disabled-look chips.
   - https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
7. **Dragging has a single-pointer alternative (SC 2.5.7)**, see topic 1.
   - https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
8. **Reflow at 320px: no horizontal page scroll** except inside a table scroll region.
   - https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
9. **Status messages (save succeeded, N results, error count) use `role="status"` / `role="alert"`** without moving focus; avoid `aria-live="assertive"` on non-urgent content (SC 4.1.3).
   - https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

### Quick automated test (Playwright + axe-core)

Package: **`@axe-core/playwright`** (peer: `@playwright/test`).
```
npm i -D @playwright/test @axe-core/playwright
```
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('leave-request page has no detectable a11y violations', async ({ page }) => {
  await page.goto('/leave-of-absence/new');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```
- Playwright's own page shows only `wcag2a, wcag2aa, wcag21a, wcag21aa`; axe-core's tag table adds `wcag22aa` and `best-practice`, so add `wcag22aa` yourself (needs a recent axe-core). https://playwright.dev/docs/accessibility-testing and https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
- `.exclude('#selector')` skips the element and all descendants for every rule; use sparingly.
- Scan each state, not just page load: open dialog, error state after submit, board with a card menu open, chatbot open, 390px viewport (`page.setViewportSize({width:390,height:844})`).
- Automated tools catch only part of WCAG; the same Playwright page says so. Add a 5-minute manual pass: Tab through the page (visible focus, no trap, logical order), zoom to 200%/320px, open every dialog by keyboard and press Escape.

---

# Top 15 checks to apply to this app (ranked for a thesis-panel demo)

1. **Error summary + inline errors on every request form**: submit-time validation, "There is a problem" with links to fields, `Error:` in the title, answers kept. (Topic 3.1-3.4)
2. **Role home = "Needs your action" list first, then at most 3-4 number tiles, each linking to the filtered list with matching counts.** (2.1-2.4)
3. **One shared status chip map**: text + icon + colour, sentence-case adjectives, same colour on boards, tables, steppers and detail pages. (5.1-5.4)
4. **"Waiting on [role] since [date] (N days)" on every case, board card and list row**, plus "Next: ..." (5.8)
5. **Every board card has a "Move to..." menu (legal stages only)**; drag is an extra, and dnd-kit keyboard + announcements enabled. (1.1-1.2)
6. **Locked cards show a lock icon and the reason; aging text/colour per stage; blocked marker separate from aging.** (1.3-1.5)
7. **Chatbot: citations naming document + section with a one-click quoted passage, specific "I couldn't find this" answer with GS office fallback, clickable suggested questions, thumbs feedback, short disclaimer.** (6.3-6.6, 6.10)
8. **Decision dialog accessibility**: focus in, trap, Escape, return focus, labelled, least-destructive default focus, outcome banner after action. (7.4, 3.11)
9. **Check-your-answers + confirmation page with reference number, "what happens next", and a printable record** for submitted requests. (3.7, 3.10)
10. **Visible focus ring everywhere and no bare `outline-none`**; sticky headers do not cover focused rows (`scroll-padding`). (7.1, 7.3)
11. **Targets >= 24px and 3:1 contrast on borders, icons and rings**, especially row-action icons, chip close buttons, grey placeholders, white-on-green buttons. (7.2, 7.6)
12. **Tables at 390px: labelled scroll region or cards; header row frozen; first column the person; filters as removable tags; pagination not infinite scroll.** (4.4, 4.6, 4.8, 4.10)
13. **Empty states replace the whole table and say what to do next** (no data / no results / error variants). (4.9, 2.9)
14. **Prefill known student data, mark "(optional)" fields, specific file-upload errors with limits stated, and save progress with a per-section task status.** (3.5, 3.6, 3.8, 3.9)
15. **Add an axe-core Playwright smoke test (`@axe-core/playwright`, tags incl. `wcag22aa`) that scans the home page, a form with errors, a board, an open dialog and the chatbot**, so "accessibility tested" is a claim you can show. (7, test block)

---

## Gaps and cautions

- Atlassian, Salesforce Lightning and Material did not yield citable home-page or dashboard rules (pages empty, 404 or blocked); the dashboard section leans on NN/g, Carbon and Shopify's published pattern. Salesforce only showed Home components (Today's Tasks, Recent Records) in setup guides, not design rules.
- Polaris index-table pages redirected; Shopify's resource-index pattern page gave little beyond "first column primary, numeric format, empty state, paginate >100 rows".
- WIP-limit guidance: Atlassian's article body did not load; no verified source for a column-header over-limit signal. Jira "flag"/swimlane behaviour comes from community posts.
- Kanban Zone aging defaults (7/14/21 days) are one vendor's choice, not a standard; pick thresholds from the real GS policy deadlines.
- NN/g has no article that I could read on citations or feedback buttons; citation guidance rests on PAIR, Microsoft HAI, and the AAAI study. A "68% abandon" figure circulating online has no primary source, so do not quote it.
- MoJ Timeline and Filter components are marked "To be reviewed"; the confirm-an-action pattern is experimental.
- Playwright's accessibility page lists WCAG 2.1 tags only; `wcag22aa` comes from axe-core's API doc. Verify the installed axe-core version supports it (run once and confirm a 2.2 rule such as `target-size` appears in `results.passes` or `results.incomplete`).
- GOV.UK guidance is written for server-rendered pages; for a React SPA, "move focus to the error summary" and "change the document title" must be done in code.

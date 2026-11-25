// UX-29 (Phase 5b): a board's final columns (Ended, Not approved, Approved, Acknowledged ...) sit behind one folded
// "Closed" strip. A test that reads a final column opens it first, the way a person would.
export async function openClosed(scope) {
  const closed = scope.getByRole("button", { name: /^Closed\s*\d+$/ });
  await scope.locator("section[aria-label]").first().waitFor(); // the board has loaded
  if ((await closed.count()) && (await closed.first().getAttribute("aria-expanded")) === "false") await closed.first().click();
}

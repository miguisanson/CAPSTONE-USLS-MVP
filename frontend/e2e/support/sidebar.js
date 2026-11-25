// UX-27 (Phase 5a): the sidebar groups fold. A test that checks the sidebar's links opens every folded group first, the
// way a person would (one click on each group heading).
export async function openSidebarGroups(page, nav = page.locator("aside:visible nav").first()) {
  const folded = nav.locator('[data-nav-toggle][aria-expanded="false"]');
  while (await folded.count()) await folded.first().click();
}

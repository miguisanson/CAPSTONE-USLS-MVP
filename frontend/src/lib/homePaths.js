// Where each role lands after signing in, and where a page sends a role that is not allowed on it (I-066): the
// back-office roles - Graduate School staff, the administrator and both coordinators - share the Dashboard at "/";
// the student, the Dean and faculty have a portal of their own. Plain JavaScript on purpose: Node can import it
// (scripts/staff-home.test.mjs).

export const HOME_PATHS = Object.freeze({
  staff: "/",
  admin: "/",
  academic_coordinator: "/",
  research_coordinator: "/",
  dean: "/dean",
  student: "/student",
  faculty: "/faculty-portal",
});

/** The home page of a role: "/login" when nobody is signed in, "/" for a role this list does not know. */
export function homePath(role) {
  if (!role) return "/login";
  return HOME_PATHS[role] || "/";
}

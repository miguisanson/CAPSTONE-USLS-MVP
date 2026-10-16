// Prints where the output landed. The temp database folder is removed at the start of the NEXT run
// (server.mjs): Flask still has the SQLite file open while this teardown runs, so it cannot be deleted here.
import { FINDINGS_DIR, SCREENS_DIR } from "./paths.mjs";

export default async function globalTeardown() {
  console.log("");
  console.log(`[e2e] Screenshots: ${SCREENS_DIR}`);
  console.log(`[e2e] Findings per role: ${FINDINGS_DIR}`);
}

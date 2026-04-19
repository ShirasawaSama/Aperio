import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

// Loose-mode guard is intentionally permissive in v1.
// Real lowering lives in src/loose (future phases).
export function guardLoose(_file: FileUnit): Diagnostic[] {
  return [];
}

import type { FileUnit } from "@aperio/ast";
import { printAst } from "@aperio/ast";

// Formatting stub. v1 keeps deterministic output to unblock golden tests.
export function formatFile(file: FileUnit): string {
  return printAst(file);
}

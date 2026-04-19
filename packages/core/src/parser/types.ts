import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

export interface ParseResult {
  file: FileUnit;
  diagnostics: Diagnostic[];
}

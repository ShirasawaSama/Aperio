import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

export interface ParseFileOptions {
  /** First AST node id for this file (default 1). Chained parses must pass previous `nextNodeIdExclusive`. */
  nextNodeIdStart?: number;
}

export interface ParseResult {
  file: FileUnit;
  diagnostics: Diagnostic[];
  /** One past the highest AST node id assigned while parsing this file. */
  nextNodeIdExclusive: number;
}

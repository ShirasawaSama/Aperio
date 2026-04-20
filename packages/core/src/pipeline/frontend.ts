import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { expandBuiltinMacros } from "../lowering/macros/expand_builtin.js";
import type { AperioMode } from "../mode/index.js";
import { guardMode } from "../mode/index.js";
import { runSemantic } from "../semantic/index.js";

/**
 * Shared mid-end pipeline after parse (and optional import merge): mode guard,
 * built-in macro expansion, then semantic analysis. Keeps CLI entrypoints aligned.
 */
export function runMidendPipeline(programFile: FileUnit, mode: AperioMode): {
  expanded: FileUnit;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  diagnostics.push(...guardMode(programFile, mode));
  const expanded = expandBuiltinMacros(programFile);
  diagnostics.push(...runSemantic(expanded).diagnostics);
  return { expanded, diagnostics };
}

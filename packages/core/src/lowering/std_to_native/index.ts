import type { FileUnit } from "@aperio/ast";
import type { LoweringContext, LoweringResult } from "../types.js";

// Contract-only entry for Std-Strict AST -> Native-Strict AST lowering.
// v1 goal: keep this seam stable while x86 direct path is still primary.
export function lowerStdToNativeAst(context: LoweringContext): LoweringResult<FileUnit> {
  return {
    output: context.source,
    diagnostics: [],
  };
}

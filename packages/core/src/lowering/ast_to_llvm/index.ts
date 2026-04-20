import type { LoweringContext, LoweringResult } from "../types.js";
import { emitAstToLlvmIr } from "./emitter.js";

// Contract-only entry for AST -> LLVM IR emission path.
// v1 keeps this as a stable seam; implementation lands incrementally.
export function lowerAstToLlvmIr(context: LoweringContext): LoweringResult<string> {
  return emitAstToLlvmIr(context);
}

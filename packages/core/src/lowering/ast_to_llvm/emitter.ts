import type { LoweringContext, LoweringResult } from "../types.js";
import { createLlvmLoweringEnv } from "./context.js";
import { diagLlvmLoweringNotImplemented } from "./diagnostics.js";

export function emitAstToLlvmIr(context: LoweringContext): LoweringResult<string> {
  const env = createLlvmLoweringEnv(context);
  env.diagnostics.push(diagLlvmLoweringNotImplemented(env));
  return {
    diagnostics: env.diagnostics,
  };
}

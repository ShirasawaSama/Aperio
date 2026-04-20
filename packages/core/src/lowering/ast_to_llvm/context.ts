import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import type { LoweringContext } from "../types.js";

export interface LlvmLoweringEnv {
  source: FileUnit;
  diagnostics: Diagnostic[];
}

export function createLlvmLoweringEnv(context: LoweringContext): LlvmLoweringEnv {
  return {
    source: context.source,
    diagnostics: [],
  };
}

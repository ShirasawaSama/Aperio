import type { Diagnostic } from "@aperio/diagnostics";
import type { LlvmLoweringEnv } from "./context.js";

export function diagLlvmLoweringNotImplemented(env: LlvmLoweringEnv): Diagnostic {
  return {
    code: "E8001",
    severity: "error",
    message: "llvm lowering path is not implemented yet",
    primary: {
      span: env.source.span,
      message: "enable this path after llvm lowering implementation lands",
    },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

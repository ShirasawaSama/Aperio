import type { LoweringContext, LoweringResult } from "../types.js";

// Contract-only entry for AST -> LLVM IR emission path.
// v1 keeps this as a stable seam; implementation lands incrementally.
export function lowerAstToLlvmIr(_context: LoweringContext): LoweringResult<string> {
  return {
    diagnostics: [
      {
        code: "E8001",
        severity: "error",
        message: "llvm lowering path is not implemented yet",
        primary: {
          span: {
            fileId: 0,
            start: 0,
            end: 0,
          },
          message: "enable this path after llvm lowering implementation lands",
        },
        secondary: [],
        notes: [],
        fixes: [],
      },
    ],
  };
}

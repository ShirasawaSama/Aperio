import type { FileUnit } from "@aperio/ast";
import { walk } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { inferExprType } from "./infer.js";

// Type checker v1 subset:
// validates literal typing surface and leaves full flow for later phases.
export function checkTypes(file: FileUnit): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  walk(file, {
    enter(node) {
      if (node.kind !== "LiteralExpr") {
        return;
      }
      const inferred = inferExprType(node);
      if (!inferred) {
        diagnostics.push({
          code: "E4004",
          severity: "error",
          message: "unable to infer literal type",
          primary: { span: node.span, message: "annotate this literal with a type suffix" },
          secondary: [],
          notes: ["full expression typing is intentionally deferred in v1"],
          fixes: [],
        });
      }
    },
  });
  return diagnostics;
}

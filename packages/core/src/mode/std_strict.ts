import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

// Std-Strict accepts strict-only syntax and rejects loose structures.
export function guardStdStrict(file: FileUnit): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    for (const stmt of item.body) {
      if (stmt.kind === "IfExprStmt" || stmt.kind === "WhileStmt" || stmt.kind === "ForStmt") {
        diagnostics.push({
          code: "E6001",
          severity: "error",
          message: "structured control flow is not allowed in std-strict mode",
          primary: { span: stmt.span, message: "use labels + goto in strict mode" },
          secondary: [],
          notes: [],
          fixes: [],
        });
      }
    }
  }
  return diagnostics;
}

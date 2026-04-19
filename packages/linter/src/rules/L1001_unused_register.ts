import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import type { LintContext, LintRule } from "../rule.js";

export const L1001UnusedRegisterRule: LintRule = {
  id: "L1001",
  description: "uses entries should be written at least once",
  defaultSeverity: "warning",
  docs: "Warn when a register is declared in `uses` but never written.",
  run(_ctx: LintContext, file: FileUnit): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const item of file.items) {
      if (item.kind !== "FnDecl") {
        continue;
      }
      for (const binding of item.uses) {
        diagnostics.push({
          code: "L1001",
          severity: "warning",
          message: `uses register '${binding.slot.name}' appears unused`,
          primary: { span: binding.span, message: "declared here" },
          secondary: [],
          notes: ["v1 rule is conservative and does not inspect dataflow yet"],
          fixes: [],
        });
      }
    }
    return diagnostics;
  },
};

import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import type { LintContext, LintRule } from "../rule.js";

export const L1002PreferAliasRule: LintRule = {
  id: "L1002",
  description: "prefer readable aliases for signature registers",
  defaultSeverity: "hint",
  docs: "Suggest `name @ rN: T` style for readability in function signatures.",
  run(_ctx: LintContext, file: FileUnit): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const item of file.items) {
      if (item.kind !== "FnDecl") {
        continue;
      }
      for (const binding of [...item.params, ...item.returns]) {
        if (binding.alias.text === binding.slot.name) {
          diagnostics.push({
            code: "L1002",
            severity: "hint",
            message: `consider aliasing '${binding.slot.name}' with a semantic name`,
            primary: { span: binding.span, message: "signature slot has no readable alias" },
            secondary: [],
            notes: [],
            fixes: [],
          });
        }
      }
    }
    return diagnostics;
  },
};

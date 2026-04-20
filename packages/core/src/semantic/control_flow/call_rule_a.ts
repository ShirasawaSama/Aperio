import type { CallArg, Expr } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import type { FnSig } from "./types.js";

export function checkCallRuleA(
  callee: Expr,
  args: CallArg[],
  signatures: Map<string, FnSig>,
  diagnostics: Diagnostic[],
): void {
  if (callee.kind !== "IdentExpr") {
    return;
  }
  const sig = signatures.get(callee.name.text);
  if (!sig) {
    return;
  }

  const assigned = new Set<string>();

  for (const arg of args) {
    if (arg.name) {
      const param = sig.params.find((item) => item.slot === arg.name?.text || item.alias === arg.name?.text);
      if (!param) {
        diagnostics.push({
          code: "E4013",
          severity: "error",
          message: `unknown call argument slot '${arg.name.text}'`,
          primary: { span: arg.name.span, message: "argument name does not match function signature" },
          secondary: [],
          notes: [],
          fixes: [],
        });
        continue;
      }
      assigned.add(param.slot);
      continue;
    }

    if (arg.value.kind !== "RegRefExpr" && arg.value.kind !== "IdentExpr") {
      diagnostics.push({
        code: "E4014",
        severity: "error",
        message: "call expression argument must specify explicit slot target",
        primary: { span: arg.span, message: "write this as '<slot> = <expr>'" },
        secondary: [],
        notes: [],
        fixes: [],
      });
      continue;
    }

    const next = sig.params.find((item) => !assigned.has(item.slot));
    if (!next) {
      diagnostics.push({
        code: "E4015",
        severity: "error",
        message: "too many positional register arguments",
        primary: { span: arg.span, message: "no remaining parameter slot in callee signature" },
        secondary: [],
        notes: [],
        fixes: [],
      });
      continue;
    }

    const valueName = arg.value.kind === "RegRefExpr" ? arg.value.name : arg.value.name.text;
    if (valueName !== next.slot && valueName !== next.alias) {
      diagnostics.push({
        code: "E4016",
        severity: "error",
        message: `positional argument must use matching slot '${next.slot}'`,
        primary: { span: arg.value.span, message: "use named syntax if slot is different (e.g. r1 = ...)" },
        secondary: [],
        notes: [],
        fixes: [],
      });
      continue;
    }

    assigned.add(next.slot);
  }
}

import type { CallArg, Expr } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import {
  diagPositionalExprNeedsTarget,
  diagPositionalSlotMismatch,
  diagTooManyPositionalArgs,
  diagUnknownCallArg,
} from "./diagnostics.js";
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
        diagnostics.push(diagUnknownCallArg(arg.name.text, arg.name.span));
        continue;
      }
      assigned.add(param.slot);
      continue;
    }

    if (arg.value.kind !== "RegRefExpr" && arg.value.kind !== "IdentExpr") {
      diagnostics.push(diagPositionalExprNeedsTarget(arg.span));
      continue;
    }

    const next = sig.params.find((item) => !assigned.has(item.slot));
    if (!next) {
      diagnostics.push(diagTooManyPositionalArgs(arg.span));
      continue;
    }

    const valueName = arg.value.kind === "RegRefExpr" ? arg.value.name : arg.value.name.text;
    if (valueName !== next.slot && valueName !== next.alias) {
      diagnostics.push(diagPositionalSlotMismatch(next.slot, arg.value.span));
      continue;
    }

    assigned.add(next.slot);
  }
}

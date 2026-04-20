import type { Expr, SlotBinding } from "@aperio/ast";
import type { Diagnostic, Span } from "@aperio/diagnostics";
import { inferExprType } from "../types/infer.js";
import type { TypeState } from "./types.js";

export function applyLabelTypeReset(params: SlotBinding[], state: TypeState): void {
  for (const param of params) {
    if (param.type) {
      state.set(param.slot.name, param.type.name);
    } else {
      state.delete(param.slot.name);
    }
  }
}

export function restoreSnapshot(state: TypeState, snapshot: TypeState): void {
  state.clear();
  for (const [key, value] of snapshot.entries()) {
    state.set(key, value);
  }
}

export function mergeBranchState(base: TypeState, thenState: TypeState, elseState: TypeState): void {
  base.clear();
  for (const [slot, thenType] of thenState.entries()) {
    const elseType = elseState.get(slot);
    if (elseType && elseType === thenType) {
      base.set(slot, thenType);
    }
  }
}

export function reportBranchTypeConflicts(
  span: Span,
  thenState: TypeState,
  elseState: TypeState,
  diagnostics: Diagnostic[],
): void {
  const slots = new Set<string>([...thenState.keys(), ...elseState.keys()]);
  for (const slot of slots) {
    const thenType = thenState.get(slot);
    const elseType = elseState.get(slot);
    if (!thenType || !elseType || thenType === elseType) {
      continue;
    }
    diagnostics.push({
      code: "E4017",
      severity: "error",
      message: `branch merge type mismatch on '${slot}'`,
      primary: {
        span,
        message: `then branch is ${thenType}, else branch is ${elseType}`,
      },
      secondary: [],
      notes: [
        "assign the same logical type on both branches, or cast explicitly before merge",
      ],
      fixes: [],
    });
  }
}

export function inferTypeName(expr: Expr, state: TypeState): string | undefined {
  if (expr.kind === "RegRefExpr") {
    return state.get(expr.name);
  }
  const inferred = inferExprType(expr);
  return inferred?.name;
}

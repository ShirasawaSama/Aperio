import type { LabelStmt } from "@aperio/ast";
import type { FlowWalkerContext } from "../context.js";
import { recordLabelIncomingState } from "../incoming.js";
import { applyLabelTypeReset } from "../state_flow.js";
import type { TypeState } from "../types.js";

export function handleLabelStmt(
  stmt: LabelStmt,
  state: TypeState,
  ctx: FlowWalkerContext,
  canFallthrough: boolean,
): boolean {
  if (canFallthrough) {
    recordLabelIncomingState(stmt.label.text, state, stmt.span, "fallthrough", ctx.incomingEdges);
  }
  applyLabelTypeReset(stmt.params, state);
  return true;
}

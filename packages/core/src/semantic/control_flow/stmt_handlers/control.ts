import type { IfStmt, SaveStmt } from "@aperio/ast";
import type { FlowWalkerContext, WalkStmtListFn } from "../context.js";
import { mergeBranchState, reportBranchTypeConflicts, restoreSnapshot } from "../state_flow.js";
import type { TypeState } from "../types.js";

export function handleSaveStmt(
  stmt: SaveStmt,
  depth: number,
  state: TypeState,
  walk: WalkStmtListFn,
): boolean {
  const snapshot = new Map(state);
  const inner = new Map(state);
  const innerFallsThrough = walk(stmt.body, depth + 1, inner);
  // save only restores when control naturally reaches block end.
  // if control exits early (goto/return), no restore happens on that path.
  if (innerFallsThrough) {
    restoreSnapshot(state, snapshot);
  }
  return innerFallsThrough;
}

export function handleIfStmt(
  stmt: IfStmt,
  depth: number,
  state: TypeState,
  ctx: FlowWalkerContext,
  walk: WalkStmtListFn,
): boolean {
  const thenState = new Map(state);
  const elseState = new Map(state);
  const thenFallsThrough = walk(stmt.thenBody, depth + 1, thenState);
  const elseFallsThrough = walk(stmt.elseBody, depth + 1, elseState);
  reportBranchTypeConflicts(stmt.span, thenState, elseState, ctx.diagnostics);
  mergeBranchState(state, thenState, elseState);
  return thenFallsThrough || elseFallsThrough;
}

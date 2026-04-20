import type { GotoStmt, IfGotoStmt } from "@aperio/ast";
import type { FlowWalkerContext } from "../context.js";
import { checkJump } from "../jump.js";
import type { TypeState } from "../types.js";

export function handleGotoStmt(
  stmt: GotoStmt,
  depth: number,
  state: TypeState,
  ctx: FlowWalkerContext,
): boolean {
  checkJump(
    stmt.label.text,
    stmt.args,
    depth,
    state,
    stmt.span,
    "goto",
    ctx.labels,
    ctx.incoming,
    ctx.incomingEdges,
    ctx.diagnostics,
  );
  return false;
}

export function handleIfGotoStmt(
  stmt: IfGotoStmt,
  depth: number,
  state: TypeState,
  ctx: FlowWalkerContext,
): boolean {
  checkJump(
    stmt.target.text,
    stmt.args,
    depth,
    state,
    stmt.span,
    "if-goto",
    ctx.labels,
    ctx.incoming,
    ctx.incomingEdges,
    ctx.diagnostics,
  );
  return true;
}

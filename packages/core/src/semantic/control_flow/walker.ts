import type { Stmt } from "@aperio/ast";
import type { FlowWalkerContext } from "./context.js";
import { handleAssignStmt } from "./stmt_handlers/assign.js";
import { handleCallStmt } from "./stmt_handlers/call.js";
import { handleIfStmt, handleSaveStmt } from "./stmt_handlers/control.js";
import { handleGotoStmt, handleIfGotoStmt } from "./stmt_handlers/jump.js";
import { handleLabelStmt } from "./stmt_handlers/label.js";
import type { TypeState } from "./types.js";

export function walkStmtList(
  stmts: Stmt[],
  depth: number,
  state: TypeState,
  ctx: FlowWalkerContext,
): boolean {
  let canFallthrough = true;
  for (const stmt of stmts) {
    if (stmt.kind !== "LabelStmt" && !canFallthrough) {
      continue;
    }
    switch (stmt.kind) {
      case "AssignStmt": {
        canFallthrough = handleAssignStmt(stmt, state);
        break;
      }
      case "LabelStmt":
        canFallthrough = handleLabelStmt(stmt, state, ctx, canFallthrough);
        break;
      case "GotoStmt":
        canFallthrough = handleGotoStmt(stmt, depth, state, ctx);
        break;
      case "IfGotoStmt":
        canFallthrough = handleIfGotoStmt(stmt, depth, state, ctx);
        break;
      case "SaveStmt": {
        canFallthrough = handleSaveStmt(stmt, depth, state, (innerStmts, innerDepth, innerState) =>
          walkStmtList(innerStmts, innerDepth, innerState, ctx),
        );
        break;
      }
      case "IfStmt": {
        canFallthrough = handleIfStmt(
          stmt,
          depth,
          state,
          ctx,
          (innerStmts, innerDepth, innerState) => walkStmtList(innerStmts, innerDepth, innerState, ctx),
        );
        break;
      }
      case "CallStmt":
        canFallthrough = handleCallStmt(stmt, ctx);
        break;
      case "ReturnStmt":
        canFallthrough = false;
        break;
      default:
        canFallthrough = true;
        break;
    }
  }
  return canFallthrough;
}

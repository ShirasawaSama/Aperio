import type { Stmt } from "@aperio/ast";
import type { LowerStmtList, LoweringEnv } from "./context.js";
import { lowerIfStmt } from "./lower_if.js";
import { lowerSaveStmt } from "./lower_save.js";

export const lowerStmtList: LowerStmtList = (stmts: Stmt[], env: LoweringEnv): Stmt[] => {
  const out: Stmt[] = [];
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "IfStmt":
        out.push(...lowerIfStmt(stmt, env, lowerStmtList));
        break;
      case "SaveStmt":
        out.push(...lowerSaveStmt(stmt, env, lowerStmtList));
        break;
      default:
        out.push(stmt);
        break;
    }
  }
  return out;
};

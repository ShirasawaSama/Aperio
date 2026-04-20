import type { SaveStmt, Stmt } from "@aperio/ast";
import { makeAssignStmt, makeRegRefExpr, toRegRefExpr } from "./builders.js";
import { allocateTempSlot } from "./collect.js";
import type { LowerStmtList, LoweringEnv } from "./context.js";

export function lowerSaveStmt(stmt: SaveStmt, env: LoweringEnv, lowerStmtList: LowerStmtList): Stmt[] {
  const prefix: Stmt[] = [];
  const suffix: Stmt[] = [];
  const allocatedTemps: string[] = [];

  for (const slot of stmt.slots) {
    const tempName = allocateTempSlot(slot.name, env.reservedRegs);
    if (!tempName) {
      env.diagnostics.push({
        code: "E7003",
        severity: "error",
        message: `unable to allocate temporary slot for save(${slot.name})`,
        primary: {
          span: slot.span,
          message: "all reserved native slots are occupied; save lowering cannot preserve value",
        },
        secondary: [],
        notes: ["reduce simultaneously live slots or reserve fewer save slots"],
        fixes: [],
      });
      releaseTemps(allocatedTemps, env.reservedRegs);
      return lowerStmtList(stmt.body, env);
    }
    allocatedTemps.push(tempName);
    prefix.push(makeAssignStmt(tempName, toRegRefExpr(slot, env.state), stmt.span, env.state));
    suffix.push(makeAssignStmt(slot.name, makeRegRefExpr(tempName, slot, env.state), stmt.span, env.state));
  }

  const loweredBody = lowerStmtList(stmt.body, env);
  releaseTemps(allocatedTemps, env.reservedRegs);
  return [...prefix, ...loweredBody, ...suffix];
}

function releaseTemps(names: string[], reservedRegs: Set<string>): void {
  for (const name of names) {
    reservedRegs.delete(name);
  }
}

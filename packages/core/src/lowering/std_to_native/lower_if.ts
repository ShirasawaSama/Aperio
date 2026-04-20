import type { IfStmt, Stmt } from "@aperio/ast";
import { makeFreshLabel, makeLabelStmt } from "./builders.js";
import type { LowerStmtList, LoweringEnv } from "./context.js";
import { nextId } from "./ids.js";

export function lowerIfStmt(stmt: IfStmt, env: LoweringEnv, lowerStmtList: LowerStmtList): Stmt[] {
  const thenLabel = makeFreshLabel("__if_then", stmt.span, env.state, env.reservedLabels);
  const elseLabel = makeFreshLabel("__if_else", stmt.span, env.state, env.reservedLabels);
  const endLabel = makeFreshLabel("__if_end", stmt.span, env.state, env.reservedLabels);
  const loweredThen = lowerStmtList(stmt.thenBody, env);
  const loweredElse = lowerStmtList(stmt.elseBody, env);

  const out: Stmt[] = [];
  out.push({
    id: nextId(env.state),
    kind: "IfGotoStmt",
    span: stmt.span,
    condition: stmt.condition,
    target: thenLabel,
    args: [],
  });
  out.push({
    id: nextId(env.state),
    kind: "GotoStmt",
    span: stmt.span,
    label: elseLabel,
    args: [],
  });
  out.push(makeLabelStmt(thenLabel, stmt.span, env.state));
  out.push(...loweredThen);
  out.push({
    id: nextId(env.state),
    kind: "GotoStmt",
    span: stmt.span,
    label: endLabel,
    args: [],
  });
  out.push(makeLabelStmt(elseLabel, stmt.span, env.state));
  out.push(...loweredElse);
  out.push(makeLabelStmt(endLabel, stmt.span, env.state));
  return out;
}

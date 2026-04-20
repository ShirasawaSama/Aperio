import type { CallStmt } from "@aperio/ast";
import type { FlowWalkerContext } from "../context.js";
import { checkCallRuleA } from "../call_rule_a.js";

export function handleCallStmt(stmt: CallStmt, ctx: FlowWalkerContext): boolean {
  checkCallRuleA(stmt.call.callee, stmt.call.args, ctx.signatures, ctx.diagnostics);
  return true;
}

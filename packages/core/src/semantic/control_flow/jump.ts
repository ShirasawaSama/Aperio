import type { Expr } from "@aperio/ast";
import type { Diagnostic, Span } from "@aperio/diagnostics";
import { diagGotoIntoInner, diagLabelArgTypeMismatch, diagLabelArityMismatch } from "./diagnostics.js";
import { recordIncomingTypes, recordLabelIncomingState } from "./incoming.js";
import type { LabelIncomingEdge, LabelIncomingType, LabelInfo, TypeState } from "./types.js";

export function checkJump(
  labelName: string,
  args: Expr[],
  sourceDepth: number,
  state: TypeState,
  edgeSpan: Span,
  edgeKind: "goto" | "if-goto",
  labels: Map<string, LabelInfo>,
  incoming: Map<string, Map<number, LabelIncomingType>>,
  incomingEdges: Map<string, LabelIncomingEdge[]>,
  diagnostics: Diagnostic[],
): void {
  const target = labels.get(labelName);
  if (!target) {
    return;
  }

  if (sourceDepth < target.depth) {
    diagnostics.push(diagGotoIntoInner(labelName, target.span));
  }

  if (args.length !== target.params.length) {
    diagnostics.push(diagLabelArityMismatch(labelName, target.params.length, args.length, target.span));
    return;
  }

  for (let i = 0; i < target.params.length; i += 1) {
    const expected = target.params[i]?.type?.name;
    const arg = args[i];
    if (!expected || !arg || arg.kind !== "RegRefExpr") {
      continue;
    }
    const actual = state.get(arg.name);
    if (actual && actual !== expected) {
      diagnostics.push(diagLabelArgTypeMismatch(labelName, expected, actual, arg.span));
    }
  }

  recordIncomingTypes(labelName, args, state, incoming, diagnostics);
  recordLabelIncomingState(labelName, state, edgeSpan, edgeKind, incomingEdges);
}

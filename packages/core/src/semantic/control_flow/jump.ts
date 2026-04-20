import type { Expr } from "@aperio/ast";
import type { Diagnostic, Span } from "@aperio/diagnostics";
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
    diagnostics.push({
      code: "E4010",
      severity: "error",
      message: `goto cannot jump into inner block label '${labelName}'`,
      primary: { span: target.span, message: "target label is inside a nested block" },
      secondary: [],
      notes: ["goto can only jump to labels in the same or outer block"],
      fixes: [],
    });
  }

  if (args.length !== target.params.length) {
    diagnostics.push({
      code: "E4011",
      severity: "error",
      message: `label '${labelName}' expects ${target.params.length} argument(s), got ${args.length}`,
      primary: { span: target.span, message: "label parameter arity mismatch" },
      secondary: [],
      notes: [],
      fixes: [],
    });
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
      diagnostics.push({
        code: "E4012",
        severity: "error",
        message: `label argument type mismatch for '${labelName}'`,
        primary: { span: arg.span, message: `expected ${expected}, got ${actual}` },
        secondary: [],
        notes: [],
        fixes: [],
      });
    }
  }

  recordIncomingTypes(labelName, args, state, incoming, diagnostics);
  recordLabelIncomingState(labelName, state, edgeSpan, edgeKind, incomingEdges);
}

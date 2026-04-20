import type { Expr, SlotBinding } from "@aperio/ast";
import type { Diagnostic, Span } from "@aperio/diagnostics";
import type { LabelIncomingEdge, LabelIncomingType, TypeState } from "./types.js";

export function recordIncomingTypes(
  labelName: string,
  args: Expr[],
  state: TypeState,
  incoming: Map<string, Map<number, LabelIncomingType>>,
  diagnostics: Diagnostic[],
): void {
  const byIndex = incoming.get(labelName) ?? new Map<number, LabelIncomingType>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg || arg.kind !== "RegRefExpr") {
      continue;
    }
    const type = state.get(arg.name);
    if (!type) {
      continue;
    }
    const previous = byIndex.get(i);
    if (!previous) {
      byIndex.set(i, { type, span: arg.span });
      continue;
    }
    if (previous.type === type) {
      continue;
    }
    diagnostics.push({
      code: "E4018",
      severity: "error",
      message: `inconsistent incoming type for label '${labelName}' parameter #${i + 1}`,
      primary: {
        span: arg.span,
        message: `this edge passes ${type}, previous edge passed ${previous.type}`,
      },
      secondary: [{ span: previous.span, message: `previous incoming type: ${previous.type}` }],
      notes: ["all incoming edges to the same label parameter should agree on logical type"],
      fixes: [],
    });
  }
  incoming.set(labelName, byIndex);
}

export function recordLabelIncomingState(
  labelName: string,
  state: TypeState,
  edgeSpan: Span,
  kind: "goto" | "if-goto" | "fallthrough",
  incomingEdges: Map<string, LabelIncomingEdge[]>,
): void {
  const edges = incomingEdges.get(labelName) ?? [];
  edges.push({
    kind,
    span: edgeSpan,
    state: new Map(state),
  });
  incomingEdges.set(labelName, edges);
}

export function validateIncomingStateMerges(
  labels: Map<string, { params: SlotBinding[] }>,
  incomingEdges: Map<string, LabelIncomingEdge[]>,
  diagnostics: Diagnostic[],
): void {
  for (const [labelName, edges] of incomingEdges.entries()) {
    if (edges.length <= 1) {
      continue;
    }
    const paramSlots = new Set((labels.get(labelName)?.params ?? []).map((item) => item.slot.name));
    const baselineBySlot = new Map<string, LabelIncomingType>();
    for (const edge of edges) {
      for (const [slot, type] of edge.state.entries()) {
        if (paramSlots.has(slot)) {
          continue;
        }
        const baseline = baselineBySlot.get(slot);
        if (!baseline) {
          baselineBySlot.set(slot, { type, span: edge.span });
          continue;
        }
        if (baseline.type === type) {
          continue;
        }
        diagnostics.push({
          code: "E4019",
          severity: "error",
          message: `inconsistent incoming state type for label '${labelName}' slot '${slot}'`,
          primary: {
            span: edge.span,
            message: `edge '${edge.kind}' has ${type}, previous edge has ${baseline.type}`,
          },
          secondary: [{ span: baseline.span, message: `previous incoming type: ${baseline.type}` }],
          notes: ["ensure all incoming edges agree on non-parameter register logical types"],
          fixes: [],
        });
      }
    }
  }
}

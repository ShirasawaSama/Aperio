import type { Expr, SlotBinding } from "@aperio/ast";
import type { Diagnostic, Span } from "@aperio/diagnostics";
import { diagIncomingParamTypeMismatch, diagIncomingStateTypeMismatch } from "./diagnostics.js";
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
    diagnostics.push(
      diagIncomingParamTypeMismatch(labelName, i, type, previous.type, arg.span, previous.span),
    );
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
        diagnostics.push(
          diagIncomingStateTypeMismatch(
            labelName,
            slot,
            edge.kind,
            type,
            baseline.type,
            edge.span,
            baseline.span,
          ),
        );
      }
    }
  }
}

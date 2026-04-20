import type { FileUnit, FnDecl } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { validateIncomingStateMerges } from "./incoming.js";
import { buildInitialTypeState, collectFnSignatures, collectLabels } from "./labels.js";
import type { FnSig, LabelInfo, LabelIncomingEdge, LabelIncomingType } from "./types.js";
import { walkStmtList } from "./walker.js";

export function checkControlFlow(file: FileUnit): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const signatures = collectFnSignatures(file);

  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    diagnostics.push(...checkFunction(item, signatures));
  }

  return diagnostics;
}

function checkFunction(fn: FnDecl, signatures: Map<string, FnSig>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const labels = new Map<string, LabelInfo>();
  const incoming = new Map<string, Map<number, LabelIncomingType>>();
  const incomingEdges = new Map<string, LabelIncomingEdge[]>();
  collectLabels(fn.body, 0, labels);
  const initial = buildInitialTypeState(fn);
  walkStmtList(fn.body, 0, initial, {
    labels,
    signatures,
    incoming,
    incomingEdges,
    diagnostics,
  });
  validateIncomingStateMerges(labels, incomingEdges, diagnostics);
  return diagnostics;
}

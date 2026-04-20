import type { Diagnostic } from "@aperio/diagnostics";
import type { FnSig, LabelInfo, LabelIncomingEdge, LabelIncomingType, TypeState } from "./types.js";

export interface FlowWalkerContext {
  labels: Map<string, LabelInfo>;
  signatures: Map<string, FnSig>;
  incoming: Map<string, Map<number, LabelIncomingType>>;
  incomingEdges: Map<string, LabelIncomingEdge[]>;
  diagnostics: Diagnostic[];
}

export type WalkStmtListFn = (stmts: import("@aperio/ast").Stmt[], depth: number, state: TypeState) => boolean;

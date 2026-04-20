import type { SlotBinding } from "@aperio/ast";
import type { Span } from "@aperio/diagnostics";

export interface LabelInfo {
  depth: number;
  params: SlotBinding[];
  span: Span;
}

export interface ParamInfo {
  slot: string;
  alias: string;
}

export interface FnSig {
  params: ParamInfo[];
}

export interface LabelIncomingType {
  type: string;
  span: Span;
}

export interface LabelIncomingEdge {
  kind: "goto" | "if-goto" | "fallthrough";
  span: Span;
  state: TypeState;
}

export type TypeState = Map<string, string>;

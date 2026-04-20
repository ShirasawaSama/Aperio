import type { Ident, LabelStmt, RegRefExpr, SlotBinding, Stmt } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { LoweringState } from "./context.js";
import { nextId } from "./ids.js";

export function makeLabelStmt(
  label: Ident,
  srcSpan: { fileId: number; start: number; end: number },
  state: LoweringState,
): LabelStmt {
  return {
    id: nextId(state),
    kind: "LabelStmt",
    span: span(srcSpan.fileId, srcSpan.start, srcSpan.end),
    label,
    params: [] satisfies SlotBinding[],
  };
}

export function makeFreshLabel(
  prefix: string,
  srcSpan: { fileId: number; start: number; end: number },
  state: LoweringState,
  reserved: Set<string>,
): Ident {
  while (true) {
    const name = `${prefix}_${nextId(state)}`;
    if (reserved.has(name)) {
      continue;
    }
    reserved.add(name);
    return {
      id: nextId(state),
      kind: "Ident",
      span: span(srcSpan.fileId, srcSpan.start, srcSpan.end),
      text: name,
    };
  }
}

export function makeAssignStmt(
  target: string,
  value: RegRefExpr,
  srcSpan: { fileId: number; start: number; end: number },
  state: LoweringState,
): Stmt {
  return {
    id: nextId(state),
    kind: "AssignStmt",
    span: span(srcSpan.fileId, srcSpan.start, srcSpan.end),
    target: makeRegRefExpr(target, value, state),
    value,
  };
}

export function toRegRefExpr(slot: RegRefExpr, state: LoweringState): RegRefExpr {
  return {
    id: nextId(state),
    kind: "RegRefExpr",
    span: slot.span,
    name: slot.name,
  };
}

export function makeRegRefExpr(
  name: string,
  src: { span: { fileId: number; start: number; end: number } },
  state: LoweringState,
): RegRefExpr {
  return {
    id: nextId(state),
    kind: "RegRefExpr",
    span: src.span,
    name,
  };
}

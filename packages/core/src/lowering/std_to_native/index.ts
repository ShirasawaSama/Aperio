import type {
  BaseNode,
  FileUnit,
  FnDecl,
  Ident,
  IfStmt,
  Item,
  LabelStmt,
  RegRefExpr,
  SaveStmt,
  SlotBinding,
  Stmt,
} from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { LoweringContext, LoweringResult } from "../types.js";

interface LoweringState {
  nextId: number;
}

export function lowerStdToNativeAst(context: LoweringContext): LoweringResult<FileUnit> {
  const state: LoweringState = {
    nextId: maxNodeId(context.source) + 1,
  };
  const diagnostics: LoweringResult<FileUnit>["diagnostics"] = [];
  const items: Item[] = context.source.items.map((item) => {
    if (item.kind !== "FnDecl") {
      return item;
    }
    const reserved = new Set<string>();
    const reservedRegs = collectUsedRegNamesForFn(item);
    collectLabelNames(item.body, reserved);
    const body = lowerStmtList(item.body, diagnostics, state, reserved, reservedRegs);
    const loweredFn: FnDecl = {
      ...item,
      body,
    };
    return loweredFn;
  });

  return {
    output: {
      ...context.source,
      items,
    },
    diagnostics,
  };
}

function lowerStmtList(
  stmts: Stmt[],
  diagnostics: LoweringResult<FileUnit>["diagnostics"],
  state: LoweringState,
  reservedLabels: Set<string>,
  reservedRegs: Set<string>,
): Stmt[] {
  const out: Stmt[] = [];
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "IfStmt":
        out.push(...lowerIfStmt(stmt, diagnostics, state, reservedLabels, reservedRegs));
        break;
      case "SaveStmt":
        out.push(...lowerSaveStmt(stmt, diagnostics, state, reservedLabels, reservedRegs));
        break;
      default:
        out.push(stmt);
        break;
    }
  }
  return out;
}

function lowerIfStmt(
  stmt: IfStmt,
  diagnostics: LoweringResult<FileUnit>["diagnostics"],
  state: LoweringState,
  reservedLabels: Set<string>,
  reservedRegs: Set<string>,
): Stmt[] {
  const thenLabel = makeFreshLabel("__if_then", stmt.span, state, reservedLabels);
  const elseLabel = makeFreshLabel("__if_else", stmt.span, state, reservedLabels);
  const endLabel = makeFreshLabel("__if_end", stmt.span, state, reservedLabels);
  const loweredThen = lowerStmtList(stmt.thenBody, diagnostics, state, reservedLabels, reservedRegs);
  const loweredElse = lowerStmtList(stmt.elseBody, diagnostics, state, reservedLabels, reservedRegs);

  const out: Stmt[] = [];
  out.push({
    id: nextId(state),
    kind: "IfGotoStmt",
    span: stmt.span,
    condition: stmt.condition,
    target: thenLabel,
    args: [],
  });
  out.push({
    id: nextId(state),
    kind: "GotoStmt",
    span: stmt.span,
    label: elseLabel,
    args: [],
  });
  out.push(makeLabelStmt(thenLabel, stmt.span, state));
  out.push(...loweredThen);
  out.push({
    id: nextId(state),
    kind: "GotoStmt",
    span: stmt.span,
    label: endLabel,
    args: [],
  });
  out.push(makeLabelStmt(elseLabel, stmt.span, state));
  out.push(...loweredElse);
  out.push(makeLabelStmt(endLabel, stmt.span, state));
  return out;
}

function lowerSaveStmt(
  stmt: SaveStmt,
  diagnostics: LoweringResult<FileUnit>["diagnostics"],
  state: LoweringState,
  reservedLabels: Set<string>,
  reservedRegs: Set<string>,
): Stmt[] {
  const prefix: Stmt[] = [];
  const suffix: Stmt[] = [];

  for (const slot of stmt.slots) {
    const tempName = allocateTempSlot(slot.name, reservedRegs);
    if (!tempName) {
      diagnostics.push({
        code: "E7003",
        severity: "error",
        message: `unable to allocate temporary slot for save(${slot.name})`,
        primary: {
          span: slot.span,
          message: "all reserved native slots are occupied; save lowering cannot preserve value",
        },
        secondary: [],
        notes: ["reduce simultaneously live slots or reserve fewer save slots"],
        fixes: [],
      });
      return lowerStmtList(stmt.body, diagnostics, state, reservedLabels, reservedRegs);
    }
    prefix.push(makeAssignStmt(tempName, toRegRefExpr(slot, state), stmt.span, state));
    suffix.push(makeAssignStmt(slot.name, makeRegRefExpr(tempName, slot, state), stmt.span, state));
  }

  const loweredBody = lowerStmtList(stmt.body, diagnostics, state, reservedLabels, reservedRegs);
  return [...prefix, ...loweredBody, ...suffix];
}

function makeLabelStmt(label: Ident, srcSpan: { fileId: number; start: number; end: number }, state: LoweringState): LabelStmt {
  return {
    id: nextId(state),
    kind: "LabelStmt",
    span: span(srcSpan.fileId, srcSpan.start, srcSpan.end),
    label,
    params: [] satisfies SlotBinding[],
  };
}

function makeFreshLabel(
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

function collectLabelNames(stmts: Stmt[], out: Set<string>): void {
  for (const stmt of stmts) {
    if (stmt.kind === "LabelStmt") {
      out.add(stmt.label.text);
      continue;
    }
    if (stmt.kind === "IfStmt") {
      collectLabelNames(stmt.thenBody, out);
      collectLabelNames(stmt.elseBody, out);
      continue;
    }
    if (stmt.kind === "SaveStmt") {
      collectLabelNames(stmt.body, out);
    }
  }
}

function collectUsedRegNamesForFn(fn: FnDecl): Set<string> {
  const used = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    const node = value as Partial<BaseNode> & { [k: string]: unknown };
    if (isRegRefNode(node)) {
      used.add(node.name);
    }
    for (const child of Object.values(node)) {
      visit(child);
    }
  };
  visit(fn);
  return used;
}

function isRegRefNode(value: unknown): value is RegRefExpr {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "RegRefExpr" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function allocateTempSlot(slotName: string, reserved: Set<string>): string | undefined {
  const cls = slotName.startsWith("f") ? "f" : "r";
  for (let i = 15; i >= 0; i -= 1) {
    const name = `${cls}${i}`;
    if (reserved.has(name)) {
      continue;
    }
    reserved.add(name);
    return name;
  }
  return undefined;
}

function makeAssignStmt(target: string, value: RegRefExpr, srcSpan: { fileId: number; start: number; end: number }, state: LoweringState): Stmt {
  return {
    id: nextId(state),
    kind: "AssignStmt",
    span: span(srcSpan.fileId, srcSpan.start, srcSpan.end),
    target: makeRegRefExpr(target, value, state),
    value,
  };
}

function toRegRefExpr(slot: RegRefExpr, state: LoweringState): RegRefExpr {
  return {
    id: nextId(state),
    kind: "RegRefExpr",
    span: slot.span,
    name: slot.name,
  };
}

function makeRegRefExpr(
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

function maxNodeId(file: FileUnit): number {
  let max = file.id;
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    const maybeNode = value as { id?: number; [k: string]: unknown };
    if (typeof maybeNode.id === "number" && maybeNode.id > max) {
      max = maybeNode.id;
    }
    for (const child of Object.values(maybeNode)) {
      visit(child);
    }
  };
  visit(file);
  return max;
}

function nextId(state: LoweringState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

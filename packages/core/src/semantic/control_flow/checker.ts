import type { CallArg, Expr, FileUnit, FnDecl, SlotBinding, Stmt } from "@aperio/ast";
import type { Diagnostic, Span } from "@aperio/diagnostics";
import { inferExprType } from "../types/infer.js";

interface LabelInfo {
  depth: number;
  params: SlotBinding[];
  span: Span;
}

interface ParamInfo {
  slot: string;
  alias: string;
}

interface FnSig {
  params: ParamInfo[];
}

type TypeState = Map<string, string>;

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
  collectLabels(fn.body, 0, labels);
  const initial = buildInitialTypeState(fn);
  checkStmtList(fn.body, 0, initial, labels, signatures, diagnostics);
  return diagnostics;
}

function collectFnSignatures(file: FileUnit): Map<string, FnSig> {
  const map = new Map<string, FnSig>();
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    map.set(item.name.text, {
      params: item.params.map((param) => ({ slot: param.slot.name, alias: param.alias.text })),
    });
  }
  return map;
}

function collectLabels(stmts: Stmt[], depth: number, labels: Map<string, LabelInfo>): void {
  for (const stmt of stmts) {
    if (stmt.kind === "LabelStmt") {
      labels.set(stmt.label.text, {
        depth,
        params: stmt.params,
        span: stmt.span,
      });
      continue;
    }
    if (stmt.kind === "SaveStmt") {
      collectLabels(stmt.body, depth + 1, labels);
      continue;
    }
    if (stmt.kind === "IfStmt") {
      collectLabels(stmt.thenBody, depth + 1, labels);
      collectLabels(stmt.elseBody, depth + 1, labels);
    }
  }
}

function buildInitialTypeState(fn: FnDecl): TypeState {
  const state: TypeState = new Map();
  for (const item of fn.params) {
    if (item.type) {
      state.set(item.slot.name, item.type.name);
    }
  }
  for (const item of fn.returns) {
    if (item.type) {
      state.set(item.slot.name, item.type.name);
    }
  }
  return state;
}

function checkStmtList(
  stmts: Stmt[],
  depth: number,
  state: TypeState,
  labels: Map<string, LabelInfo>,
  signatures: Map<string, FnSig>,
  diagnostics: Diagnostic[],
): void {
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "AssignStmt": {
        const inferred = inferTypeName(stmt.value, state);
        if (inferred) {
          state.set(stmt.target.name, inferred);
        } else {
          state.delete(stmt.target.name);
        }
        break;
      }
      case "LabelStmt":
        applyLabelTypeReset(stmt.params, state);
        break;
      case "GotoStmt":
        checkJump(stmt.label.text, stmt.args, depth, state, labels, diagnostics);
        break;
      case "IfGotoStmt":
        checkJump(stmt.target.text, stmt.args, depth, state, labels, diagnostics);
        break;
      case "SaveStmt": {
        const snapshot = new Map(state);
        const inner = new Map(state);
        checkStmtList(stmt.body, depth + 1, inner, labels, signatures, diagnostics);
        restoreSnapshot(state, snapshot);
        break;
      }
      case "IfStmt": {
        const thenState = new Map(state);
        const elseState = new Map(state);
        checkStmtList(stmt.thenBody, depth + 1, thenState, labels, signatures, diagnostics);
        checkStmtList(stmt.elseBody, depth + 1, elseState, labels, signatures, diagnostics);
        mergeBranchState(state, thenState, elseState);
        break;
      }
      case "CallStmt":
        checkCallRuleA(stmt.call.callee, stmt.call.args, signatures, diagnostics);
        break;
      default:
        break;
    }
  }
}

function applyLabelTypeReset(params: SlotBinding[], state: TypeState): void {
  for (const param of params) {
    if (param.type) {
      state.set(param.slot.name, param.type.name);
    } else {
      state.delete(param.slot.name);
    }
  }
}

function checkJump(
  labelName: string,
  args: Expr[],
  sourceDepth: number,
  state: TypeState,
  labels: Map<string, LabelInfo>,
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
}

function checkCallRuleA(
  callee: Expr,
  args: CallArg[],
  signatures: Map<string, FnSig>,
  diagnostics: Diagnostic[],
): void {
  if (callee.kind !== "IdentExpr") {
    return;
  }
  const sig = signatures.get(callee.name.text);
  if (!sig) {
    return;
  }

  const assigned = new Set<string>();

  for (const arg of args) {
    if (arg.name) {
      const param = sig.params.find((item) => item.slot === arg.name?.text || item.alias === arg.name?.text);
      if (!param) {
        diagnostics.push({
          code: "E4013",
          severity: "error",
          message: `unknown call argument slot '${arg.name.text}'`,
          primary: { span: arg.name.span, message: "argument name does not match function signature" },
          secondary: [],
          notes: [],
          fixes: [],
        });
        continue;
      }
      assigned.add(param.slot);
      continue;
    }

    if (arg.value.kind !== "RegRefExpr" && arg.value.kind !== "IdentExpr") {
      diagnostics.push({
        code: "E4014",
        severity: "error",
        message: "call expression argument must specify explicit slot target",
        primary: { span: arg.span, message: "write this as '<slot> = <expr>'" },
        secondary: [],
        notes: [],
        fixes: [],
      });
      continue;
    }

    const next = sig.params.find((item) => !assigned.has(item.slot));
    if (!next) {
      diagnostics.push({
        code: "E4015",
        severity: "error",
        message: "too many positional register arguments",
        primary: { span: arg.span, message: "no remaining parameter slot in callee signature" },
        secondary: [],
        notes: [],
        fixes: [],
      });
      continue;
    }

    const valueName = arg.value.kind === "RegRefExpr" ? arg.value.name : arg.value.name.text;
    if (valueName !== next.slot && valueName !== next.alias) {
      diagnostics.push({
        code: "E4016",
        severity: "error",
        message: `positional argument must use matching slot '${next.slot}'`,
        primary: { span: arg.value.span, message: "use named syntax if slot is different (e.g. r1 = ...)" },
        secondary: [],
        notes: [],
        fixes: [],
      });
      continue;
    }

    assigned.add(next.slot);
  }
}

function restoreSnapshot(state: TypeState, snapshot: TypeState): void {
  state.clear();
  for (const [key, value] of snapshot.entries()) {
    state.set(key, value);
  }
}

function mergeBranchState(base: TypeState, thenState: TypeState, elseState: TypeState): void {
  base.clear();
  for (const [slot, thenType] of thenState.entries()) {
    const elseType = elseState.get(slot);
    if (elseType && elseType === thenType) {
      base.set(slot, thenType);
    }
  }
}

function inferTypeName(expr: Expr, state: TypeState): string | undefined {
  if (expr.kind === "RegRefExpr") {
    return state.get(expr.name);
  }
  const inferred = inferExprType(expr);
  return inferred?.name;
}

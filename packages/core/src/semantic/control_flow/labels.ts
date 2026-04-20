import type { FileUnit, FnDecl, Stmt } from "@aperio/ast";
import type { FnSig, LabelInfo, TypeState } from "./types.js";

export function collectFnSignatures(file: FileUnit): Map<string, FnSig> {
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

export function collectLabels(stmts: Stmt[], depth: number, labels: Map<string, LabelInfo>): void {
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

export function buildInitialTypeState(fn: FnDecl): TypeState {
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

import type { BaseNode, FnDecl, RegRefExpr, Stmt } from "@aperio/ast";

export function collectLabelNames(stmts: Stmt[], out: Set<string>): void {
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

export function collectUsedRegNamesForFn(fn: FnDecl): Set<string> {
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

export function allocateTempSlot(slotName: string, reserved: Set<string>): string | undefined {
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


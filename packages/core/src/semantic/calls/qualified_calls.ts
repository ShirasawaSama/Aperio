import type { CallStmt, FileUnit, FnDecl, Stmt } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

/** Split `alias::name` at the first `::` (import alias is always the left segment). */
export function splitImportQualifiedCallee(text: string): { prefix: string; short: string } | undefined {
  const idx = text.indexOf("::");
  if (idx < 0) {
    return undefined;
  }
  const prefix = text.slice(0, idx);
  const short = text.slice(idx + 2);
  if (prefix.length === 0 || short.length === 0) {
    return undefined;
  }
  return { prefix, short };
}

/**
 * After `expandBuiltinMacros`, every `import … as X` qualified call `X::foo` should resolve to a
 * top-level `extern fn` / `fn` (or macro) in the merged compilation unit.
 */
export function checkQualifiedCalls(file: FileUnit): Diagnostic[] {
  const importAliases = new Set<string>();
  const topDeclNames = new Set<string>();
  const macroNames = new Set<string>();
  for (const item of file.items) {
    if (item.kind === "ImportDecl") {
      importAliases.add(item.alias.text);
    }
    if (item.kind === "ExternFnDecl" || item.kind === "FnDecl") {
      topDeclNames.add(item.name.text);
    }
    if (item.kind === "MacroDecl") {
      macroNames.add(item.name.text);
    }
  }

  const diagnostics: Diagnostic[] = [];
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    walkFnBody(item, importAliases, topDeclNames, macroNames, diagnostics);
  }
  return diagnostics;
}

function walkFnBody(
  fn: FnDecl,
  importAliases: Set<string>,
  topDeclNames: Set<string>,
  macroNames: Set<string>,
  diagnostics: Diagnostic[],
): void {
  for (const stmt of fn.body) {
    walkStmt(stmt, importAliases, topDeclNames, macroNames, diagnostics);
  }
}

function walkStmt(
  stmt: Stmt,
  importAliases: Set<string>,
  topDeclNames: Set<string>,
  macroNames: Set<string>,
  diagnostics: Diagnostic[],
): void {
  switch (stmt.kind) {
    case "CallStmt":
      checkQualifiedCallStmt(stmt, importAliases, topDeclNames, macroNames, diagnostics);
      return;
    case "IfStmt":
      for (const s of stmt.thenBody) {
        walkStmt(s, importAliases, topDeclNames, macroNames, diagnostics);
      }
      for (const s of stmt.elseBody) {
        walkStmt(s, importAliases, topDeclNames, macroNames, diagnostics);
      }
      return;
    case "SaveStmt":
      for (const s of stmt.body) {
        walkStmt(s, importAliases, topDeclNames, macroNames, diagnostics);
      }
      return;
    default:
      return;
  }
}

function checkQualifiedCallStmt(
  stmt: CallStmt,
  importAliases: Set<string>,
  topDeclNames: Set<string>,
  macroNames: Set<string>,
  diagnostics: Diagnostic[],
): void {
  if (stmt.call.callee.kind !== "IdentExpr") {
    return;
  }
  const text = stmt.call.callee.name.text;
  const parts = splitImportQualifiedCallee(text);
  if (!parts) {
    return;
  }
  const { prefix, short } = parts;
  if (!importAliases.has(prefix)) {
    return;
  }
  if (short.startsWith("__macro_")) {
    return;
  }
  if (macroNames.has(short)) {
    return;
  }
  if (topDeclNames.has(short)) {
    return;
  }
  diagnostics.push({
    code: "E5020",
    severity: "error",
    message: `no top-level extern or function '${short}' for import alias '${prefix}'`,
    primary: {
      span: stmt.call.callee.span,
      message: "unknown qualified callee",
    },
    secondary: [],
    notes: [],
    fixes: [],
  });
}

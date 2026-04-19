import type {
  FileAliasDecl,
  FileUnit,
  FnBodyAliasDecl,
  FnDecl,
  RegRefExpr,
  SlotBinding,
} from "@aperio/ast";
import { walk } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { type AliasScope, ScopedAliasTable } from "./scoped_table.js";

export interface AliasResolveResult {
  diagnostics: Diagnostic[];
  tableByFunctionId: Map<number, ScopedAliasTable>;
}

const RESERVED_ALIAS_NAMES = new Set(["mem", "stack"]);

// Resolves alias declarations and validates strict replacement constraints.
export function resolveAliases(file: FileUnit): AliasResolveResult {
  const diagnostics: Diagnostic[] = [];
  const fileTable = new ScopedAliasTable();
  const functionTables = new Map<number, ScopedAliasTable>();

  for (const item of file.items) {
    if (item.kind === "FileAliasDecl") {
      validateAndAddBinding(item.binding, fileTable, diagnostics, "file");
    }
  }

  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    const table = new ScopedAliasTable();
    copyFileAliases(fileTable, table);
    for (const binding of [...item.params, ...item.returns, ...item.uses]) {
      validateAndAddBinding(binding, table, diagnostics, "signature");
    }
    for (const stmt of item.body) {
      if (stmt.kind === "FnBodyAliasDecl") {
        validateAndAddBinding(stmt.binding, table, diagnostics, "body");
      }
    }
    validateRawSlotUsages(item, table, diagnostics);
    functionTables.set(item.id, table);
  }

  return { diagnostics, tableByFunctionId: functionTables };
}

function copyFileAliases(src: ScopedAliasTable, dst: ScopedAliasTable): void {
  for (const entry of src.fileEntries()) {
    const binding = {
      kind: "SlotBinding",
      id: 0,
      span: { fileId: 0, start: 0, end: 0 },
      alias: {
        kind: "Ident",
        id: 0,
        span: { fileId: 0, start: 0, end: 0 },
        text: entry.name,
      },
      slot: {
        kind: "RegRefExpr",
        id: 0,
        span: { fileId: 0, start: 0, end: 0 },
        name: entry.slot,
      },
    } as SlotBinding;
    dst.add("file", binding);
  }
}

function validateAndAddBinding(
  binding: SlotBinding,
  table: ScopedAliasTable,
  diagnostics: Diagnostic[],
  scope: AliasScope,
): void {
  const alias = binding.alias.text;
  const slot = binding.slot.name;
  const isImplicitSlotAlias = alias === slot;
  if (!/^r\d+$|^f\d+$/.test(slot)) {
    diagnostics.push(makeDiag(binding, "E3005", `invalid slot '${slot}'`));
    return;
  }
  if (!isImplicitSlotAlias && (RESERVED_ALIAS_NAMES.has(alias) || /^r\d+$|^f\d+$/.test(alias))) {
    diagnostics.push(makeDiag(binding, "E3002", `reserved alias name '${alias}'`));
    return;
  }
  if (!isImplicitSlotAlias && table.lookupSlot(alias) !== undefined) {
    diagnostics.push(makeDiag(binding, "E3002", `duplicate alias '${alias}'`));
    return;
  }
  table.add(scope, binding);
}

function validateRawSlotUsages(
  fnDecl: FnDecl,
  table: ScopedAliasTable,
  diagnostics: Diagnostic[],
): void {
  walk(fnDecl, {
    onFnBodyAliasDecl(_node: FnBodyAliasDecl) {
      // Alias declarations are already validated in a dedicated pass.
    },
    onFileAliasDecl(_node: FileAliasDecl) {
      // Not reachable for FnDecl traversal, kept for completeness.
    },
    enter(node) {
      if (node.kind !== "RegRefExpr") {
        return;
      }
      const reg = node as RegRefExpr;
      const aliasName = table.lookupName(reg.name);
      if (table.hasSlotInAnyScope(reg.name) && aliasName !== undefined && aliasName !== reg.name) {
        diagnostics.push(
          makeDiag(reg, "E3001", `raw slot '${reg.name}' used where alias is active`),
        );
      }
    },
  });
}

function makeDiag(
  node: { span: { fileId: number; start: number; end: number } },
  code: string,
  message: string,
): Diagnostic {
  return {
    code,
    severity: "error",
    message,
    primary: { span: node.span, message },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

import type { FileUnit, ImportDecl, Item } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import type { Token } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { resolve } from "node:path";
import { resolveImportToAbsolutePath } from "./stdlib_root.js";

export interface LoadModuleTokens {
  (absPath: string, text: string): { tokens: Token[]; diagnostics: Diagnostic[] };
}

export interface MergeCompilationUnitInput {
  /** Absolute path to the entry `.ap` file (used for relative imports). */
  entryPath: string;
  entryFile: FileUnit;
  entryNextNodeIdExclusive: number;
  /** Root such that `join(stdlibRoot, "std/os/win.ap")` resolves. Required for `std/…` imports. */
  stdlibRoot: string;
  readSource: (absPath: string) => string | undefined;
  loadTokens: LoadModuleTokens;
}

export interface MergeCompilationUnitResult {
  file: FileUnit;
  diagnostics: Diagnostic[];
  nextNodeIdExclusive: number;
}

/**
 * Loads transitively imported modules (BFS), hoists their top-level items into one `FileUnit`
 * (after the entry items). Skips `FnDecl` and `ImportDecl` from imported files; still follows
 * nested imports to pull in their symbols.
 */
export function mergeCompilationUnit(input: MergeCompilationUnitInput): MergeCompilationUnitResult {
  const diagnostics: Diagnostic[] = [];
  const normalizedEntry = resolveNorm(input.entryPath);
  const visited = new Set<string>([normalizedEntry]);
  const queue: { absPath: string; importSpan?: ImportDecl }[] = [];

  for (const item of input.entryFile.items) {
    if (item.kind !== "ImportDecl") {
      continue;
    }
    const abs = resolveImportToAbsolutePath({
      stdlibRoot: input.stdlibRoot,
      importerPath: input.entryPath,
      importPath: item.path,
    });
    if (!abs) {
      diagnostics.push(unknownImportSchemeDiag(item));
      continue;
    }
    queue.push({ absPath: abs, importSpan: item });
  }

  const hoisted: Item[] = [];
  const hoistedTopLevelNames = new Set<string>(collectTopLevelNames(input.entryFile.items));
  let nextNodeId = input.entryNextNodeIdExclusive;

  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    const absNorm = resolveNorm(job.absPath);
    if (visited.has(absNorm)) {
      continue;
    }

    const text = input.readSource(absNorm);
    if (text === undefined) {
      diagnostics.push(missingImportTargetDiag(job.importSpan, job.absPath));
      continue;
    }
    visited.add(absNorm);

    const { tokens, diagnostics: lexDiags } = input.loadTokens(absNorm, text);
    diagnostics.push(...lexDiags);

    const parsed = parseFile(absNorm, tokens, { nextNodeIdStart: nextNodeId });
    diagnostics.push(...parsed.diagnostics);
    nextNodeId = parsed.nextNodeIdExclusive;

    for (const item of parsed.file.items) {
      if (item.kind === "ImportDecl") {
        const nested = resolveImportToAbsolutePath({
          stdlibRoot: input.stdlibRoot,
          importerPath: absNorm,
          importPath: item.path,
        });
        if (!nested) {
          diagnostics.push(unknownImportSchemeDiag(item));
          continue;
        }
        queue.push({ absPath: nested, importSpan: item });
        continue;
      }
      if (item.kind === "FnDecl") {
        continue;
      }

      const nameKey = topLevelSymbolKey(item);
      if (nameKey !== undefined) {
        if (hoistedTopLevelNames.has(nameKey)) {
          diagnostics.push(duplicateTopLevelNameDiag(item, nameKey));
          continue;
        }
        hoistedTopLevelNames.add(nameKey);
      }
      hoisted.push(item);
    }
  }

  return {
    file: {
      ...input.entryFile,
      items: [...input.entryFile.items, ...hoisted],
    },
    diagnostics,
    nextNodeIdExclusive: nextNodeId,
  };
}

function resolveNorm(p: string): string {
  return resolve(p);
}

function topLevelSymbolKey(item: Item): string | undefined {
  switch (item.kind) {
    case "ExternFnDecl":
    case "FnDecl":
    case "ConstDecl":
    case "ValDecl":
    case "VarDecl":
    case "StructDecl":
    case "TypeAliasDecl":
    case "MacroDecl":
      return item.name.text;
    case "FileAliasDecl":
      return item.binding.alias.text;
    default:
      return undefined;
  }
}

function collectTopLevelNames(items: Item[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    const k = topLevelSymbolKey(item);
    if (k !== undefined) {
      out.push(k);
    }
  }
  return out;
}

function unknownImportSchemeDiag(decl: ImportDecl): Diagnostic {
  return {
    code: "E5011",
    severity: "error",
    message: `unsupported import path '${decl.path}' (expected std/…, ./…, or ../…)`,
    primary: { span: decl.span, message: "invalid import" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

function missingImportTargetDiag(decl: ImportDecl | undefined, attemptedPath: string): Diagnostic {
  const span = decl?.span ?? { fileId: 0, start: 0, end: 0 };
  return {
    code: "E5012",
    severity: "error",
    message: `cannot read imported module '${attemptedPath}'`,
    primary: { span, message: "file not found" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

function duplicateTopLevelNameDiag(item: Item, name: string): Diagnostic {
  return {
    code: "E5013",
    severity: "error",
    message: `duplicate top-level name '${name}' while merging imports`,
    primary: { span: item.span, message: "conflicts with entry or another imported module" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

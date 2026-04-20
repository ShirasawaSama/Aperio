import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { mergeCompilationUnit } from "../loader/merge_imports.js";
import { findStdlibRootNearEntry } from "../loader/stdlib_root.js";
import { lex } from "../lexer/lexer.js";
import type { AperioMode } from "../mode/index.js";
import { modeFromPath } from "../mode/index.js";
import { parseFile } from "../parser/parser.js";
import type { SourceManager } from "../source/source_manager.js";
import { runMidendPipeline } from "./frontend.js";

export type MissingStdlibBehavior =
  | "silent"
  | { diagnostic: Diagnostic };

export interface PrepareProgramFromSourceInput {
  resolvedPath: string;
  sourceText: string;
  entryFileId: number;
  sourceManager: SourceManager;
  mode: AperioMode | "auto";
  /** When omitted, stdlib resolution failures are silent (check/ast). */
  missingStdlibBehavior?: MissingStdlibBehavior;
}

export interface PrepareProgramFromSourceResult {
  expanded: FileUnit;
  diagnostics: Diagnostic[];
  /** True if lex or parse produced at least one error (before merge / mid-end). */
  lexParseHadError: boolean;
}

function entryNeedsStdlibRoot(file: FileUnit): boolean {
  for (const item of file.items) {
    if (item.kind === "ImportDecl" && item.path.replaceAll("\\", "/").startsWith("std/")) {
      return true;
    }
  }
  return false;
}

function resolveStdlibRoot(resolvedPath: string): string | undefined {
  let stdlibRoot = findStdlibRootNearEntry(resolvedPath);
  if (stdlibRoot === undefined) {
    const cwdStdlib = join(process.cwd(), "stdlib");
    const marker = join(cwdStdlib, "std", "os", "win.ap");
    if (existsSync(marker)) {
      stdlibRoot = cwdStdlib;
    }
  }
  return stdlibRoot;
}

/**
 * Lex → parse → optional import merge → mid-end pipeline for one entry file already
 * registered on `sourceManager` at `entryFileId`.
 */
export function prepareProgramFromSource(
  input: PrepareProgramFromSourceInput,
): PrepareProgramFromSourceResult {
  const diagnostics: Diagnostic[] = [];
  const mode: AperioMode = input.mode === "auto" ? modeFromPath(input.resolvedPath) : input.mode;

  const lexResult = lex(input.entryFileId, input.sourceText);
  diagnostics.push(...lexResult.diagnostics);

  const parseResult = parseFile(input.resolvedPath, lexResult.tokens);
  diagnostics.push(...parseResult.diagnostics);
  const lexParseHadError = [...lexResult.diagnostics, ...parseResult.diagnostics].some(
    (d) => d.severity === "error",
  );

  let programFile = parseResult.file;
  const needsStd = entryNeedsStdlibRoot(programFile);
  const stdlibRoot = resolveStdlibRoot(input.resolvedPath);
  const missingBehavior = input.missingStdlibBehavior ?? "silent";

  if (needsStd && stdlibRoot === undefined && missingBehavior !== "silent") {
    diagnostics.push(missingBehavior.diagnostic);
  }

  const canMergeImports = !needsStd || stdlibRoot !== undefined;
  if (canMergeImports) {
    const stdlibRootForMerge = stdlibRoot ?? join(process.cwd(), "stdlib");
    const merged = mergeCompilationUnit({
      entryPath: input.resolvedPath,
      entryFile: programFile,
      entryNextNodeIdExclusive: parseResult.nextNodeIdExclusive,
      stdlibRoot: stdlibRootForMerge,
      readSource(absPath) {
        const existing = input.sourceManager.getByPath(absPath);
        if (existing !== undefined) {
          return existing.file.source;
        }
        try {
          return readFileSync(absPath, "utf8");
        } catch {
          return undefined;
        }
      },
      loadTokens(absPath, text) {
        const entry = input.sourceManager.getByPath(absPath) ?? input.sourceManager.addFile(absPath, text);
        return lex(entry.file.id, text);
      },
    });
    diagnostics.push(...merged.diagnostics);
    programFile = merged.file;
  }

  const mid = runMidendPipeline(programFile, mode);
  diagnostics.push(...mid.diagnostics);

  return { expanded: mid.expanded, diagnostics, lexParseHadError };
}

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { printAst } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { findStdlibRootNearEntry, mergeCompilationUnit, runMidendPipeline } from "@aperio/core";
import { lex } from "@aperio/lexer";
import { modeFromPath } from "@aperio/mode";
import { parseFile } from "@aperio/parser";
import { SourceManager } from "@aperio/source";

/** Parse, merge imports when needed, run mid-end passes, then print JSON AST (matches build/check view). */
export async function runAst(file: string): Promise<number> {
  const text = await readFile(file, "utf8");
  const resolvedPath = resolve(file);
  const sourceManager = new SourceManager();
  const entry = sourceManager.addFile(resolvedPath, text);
  const lexResult = lex(entry.file.id, text);
  const parseResult = parseFile(resolvedPath, lexResult.tokens);

  let mergeDiags: Diagnostic[] = [];
  const hasImport = parseResult.file.items.some((i) => i.kind === "ImportDecl");
  let programFile = parseResult.file;
  if (hasImport) {
    let stdlibRoot = findStdlibRootNearEntry(resolvedPath);
    if (!stdlibRoot) {
      const fallback = resolve(process.cwd(), "stdlib");
      if (existsSync(join(fallback, "std", "os", "win.ap"))) {
        stdlibRoot = fallback;
      }
    }
    if (stdlibRoot) {
      const merged = mergeCompilationUnit({
        entryPath: resolvedPath,
        entryFile: parseResult.file,
        entryNextNodeIdExclusive: parseResult.nextNodeIdExclusive,
        stdlibRoot,
        readSource: (abs) => {
          try {
            return readFileSync(abs, "utf8");
          } catch {
            return undefined;
          }
        },
        loadTokens: (absPath, src) => {
          const existing = sourceManager.getByPath(absPath);
          const mod = existing ?? sourceManager.addFile(absPath, src);
          return lex(mod.file.id, src);
        },
      });
      mergeDiags = merged.diagnostics;
      programFile = merged.file;
    }
  }

  const mode = modeFromPath(file);
  const { expanded, diagnostics: midendDiags } = runMidendPipeline(programFile, mode);

  const lexParseErrors = [...lexResult.diagnostics, ...parseResult.diagnostics].some((d) => d.severity === "error");
  if (lexParseErrors) {
    process.stdout.write("[]\n");
    return 1;
  }

  process.stdout.write(`${printAst(expanded)}\n`);

  const restErrors = [...mergeDiags, ...midendDiags].some((d) => d.severity === "error");
  return restErrors ? 1 : 0;
}

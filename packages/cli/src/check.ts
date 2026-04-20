import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Diagnostic, SourceMap } from "@aperio/diagnostics";
import {
  renderDiagnosticsHuman,
  renderDiagnosticsJson,
  renderDiagnosticsLsp,
} from "@aperio/diagnostics";
import { lex } from "@aperio/lexer";
import { type AperioMode, guardMode, modeFromPath } from "@aperio/mode";
import { expandBuiltinMacros, findStdlibRootNearEntry, mergeCompilationUnit } from "@aperio/core";
import { parseFile } from "@aperio/parser";
import { runSemantic } from "@aperio/semantic";
import { SourceManager } from "@aperio/source";
import type { OutputFormat } from "./format_opt.js";

export interface CheckOptions {
  format: OutputFormat;
  mode: "auto" | AperioMode;
}

export async function runCheck(files: string[], options: CheckOptions): Promise<number> {
  const targets = files.length > 0 ? files : ["packages/core/test/fixtures/hello.ap"];
  const sourceManager = new SourceManager();
  const diagnostics: Diagnostic[] = [];

  for (const path of targets) {
    const text = await readFile(path, "utf8");
    const resolvedPath = resolve(path);
    const entry = sourceManager.addFile(resolvedPath, text);
    const lexResult = lex(entry.file.id, text);
    diagnostics.push(...lexResult.diagnostics);
    const parseResult = parseFile(resolvedPath, lexResult.tokens);
    diagnostics.push(...parseResult.diagnostics);

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
        diagnostics.push(...merged.diagnostics);
        programFile = merged.file;
      }
    }

    const mode = options.mode === "auto" ? modeFromPath(path) : options.mode;
    diagnostics.push(...guardMode(programFile, mode));
    const expanded = expandBuiltinMacros(programFile);
    diagnostics.push(...runSemantic(expanded).diagnostics);
  }

  const rendered = renderDiagnostics(
    diagnostics,
    options.format,
    sourceManagerToMap(sourceManager),
  );
  process.stdout.write(`${rendered}\n`);
  return diagnostics.some((d) => d.severity === "error") ? 1 : 0;
}

function renderDiagnostics(diags: Diagnostic[], format: OutputFormat, map: SourceMap): string {
  switch (format) {
    case "json":
      return renderDiagnosticsJson(diags);
    case "lsp":
      return renderDiagnosticsLsp(diags, map);
    case "human":
    default:
      return renderDiagnosticsHuman(diags, map);
  }
}

function sourceManagerToMap(sourceManager: SourceManager): SourceMap {
  return {
    toSourceRange(targetSpan) {
      const entry = sourceManager.getById(targetSpan.fileId);
      if (!entry) {
        return {
          start: { fileId: targetSpan.fileId, line: 1, column: 1 },
          end: { fileId: targetSpan.fileId, line: 1, column: 1 },
        };
      }
      const start = entry.file.offsetToLineColumn(targetSpan.start);
      const end = entry.file.offsetToLineColumn(targetSpan.end);
      return {
        start: { fileId: targetSpan.fileId, line: start.line, column: start.column },
        end: { fileId: targetSpan.fileId, line: end.line, column: end.column },
      };
    },
  };
}

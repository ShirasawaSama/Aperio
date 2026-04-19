import { readFile } from "node:fs/promises";
import type { Diagnostic, SourceMap } from "@aperio/diagnostics";
import {
  renderDiagnosticsHuman,
  renderDiagnosticsJson,
  renderDiagnosticsLsp,
} from "@aperio/diagnostics";
import { lex } from "@aperio/lexer";
import { type AperioMode, guardMode, modeFromPath } from "@aperio/mode";
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
    const entry = sourceManager.addFile(path, text);
    const lexResult = lex(entry.file.id, text);
    diagnostics.push(...lexResult.diagnostics);
    const parseResult = parseFile(path, lexResult.tokens);
    diagnostics.push(...parseResult.diagnostics);
    const mode = options.mode === "auto" ? modeFromPath(path) : options.mode;
    diagnostics.push(...guardMode(parseResult.file, mode));
    diagnostics.push(...runSemantic(parseResult.file).diagnostics);
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

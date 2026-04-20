import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Diagnostic, SourceMap } from "@aperio/diagnostics";
import {
  renderDiagnosticsHuman,
  renderDiagnosticsJson,
  renderDiagnosticsLsp,
} from "@aperio/diagnostics";
import { prepareProgramFromSource } from "@aperio/core";
import { type AperioMode, modeFromPath } from "@aperio/mode";
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
    const mode = options.mode === "auto" ? modeFromPath(path) : options.mode;
    const prep = prepareProgramFromSource({
      resolvedPath,
      sourceText: text,
      entryFileId: entry.file.id,
      sourceManager,
      mode,
    });
    diagnostics.push(...prep.diagnostics);
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

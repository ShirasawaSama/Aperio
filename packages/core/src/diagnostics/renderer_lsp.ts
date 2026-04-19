import type { Diagnostic, Severity } from "./diagnostic.js";
import type { SourceMap } from "./source_map.js";

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspDiagnostic {
  range: LspRange;
  severity: number;
  code: string;
  message: string;
}

// Map internal severity to LSP numeric severity:
// 1 = Error, 2 = Warning, 3 = Information, 4 = Hint.
function toLspSeverity(severity: Severity): number {
  switch (severity) {
    case "error":
      return 1;
    case "warning":
      return 2;
    case "info":
      return 3;
    case "hint":
      return 4;
    default:
      return 3;
  }
}

// Converts diagnostics into an LSP-compatible payload.
export function renderDiagnosticsLsp(diags: Diagnostic[], map: SourceMap): string {
  const payload: LspDiagnostic[] = diags.map((diag) => {
    const range = map.toSourceRange(diag.primary.span);
    return {
      range: {
        // LSP is 0-based for both line and character.
        start: { line: range.start.line - 1, character: range.start.column - 1 },
        end: { line: range.end.line - 1, character: range.end.column - 1 },
      },
      severity: toLspSeverity(diag.severity),
      code: diag.code,
      message: diag.message,
    };
  });
  return JSON.stringify(payload, null, 2);
}

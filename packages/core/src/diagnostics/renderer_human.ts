import type { Diagnostic } from "./diagnostic.js";
import type { SourceMap } from "./source_map.js";

// Rustc-like plain text renderer for CLI output.
// Keep this formatting stable because tests will snapshot it.
export function renderDiagnosticsHuman(diags: Diagnostic[], map: SourceMap): string {
  if (diags.length === 0) {
    return "no diagnostics";
  }
  return diags
    .map((diag) => {
      const pos = map.toSourceRange(diag.primary.span).start;
      const head = `${diag.severity}[${diag.code}]: ${diag.message}`;
      const at = ` --> file#${pos.fileId}:${pos.line}:${pos.column}`;
      const notes = diag.notes.map((n) => ` note: ${n}`).join("\n");
      return [head, at, notes].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

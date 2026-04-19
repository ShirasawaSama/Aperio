export type {
  Diagnostic,
  Fix,
  Label,
  Severity,
  TextEdit,
} from "./diagnostic.js";
export { DiagnosticRanges } from "./diagnostic.js";
export { renderDiagnosticsHuman } from "./renderer_human.js";
export { renderDiagnosticsJson } from "./renderer_json.js";
export type { LspDiagnostic, LspPosition, LspRange } from "./renderer_lsp.js";
export { renderDiagnosticsLsp } from "./renderer_lsp.js";
export type { SourceMap, SourcePosition, SourceRange } from "./source_map.js";
export type { Span } from "./span.js";
export { span } from "./span.js";

import type { Span } from "./span.js";

// Human-facing file location (1-based line/column).
export interface SourcePosition {
  fileId: number;
  line: number;
  column: number;
}

// SourceRange is used by human/json/lsp renderers.
export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

// SourceMap converts low-level spans back to line/column pairs.
// Concrete implementation will live in src/source once line tables are added.
export interface SourceMap {
  toSourceRange(span: Span): SourceRange;
}

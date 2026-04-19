import type { Span } from "./span.js";

// Severity is intentionally aligned with LSP diagnostic severities.
export type Severity = "error" | "warning" | "hint" | "info";

// Label points to a source span with a human-readable explanation.
export interface Label {
  span: Span;
  message: string;
}

// TextEdit is reused by lint fixes and parser recovery hints.
export interface TextEdit {
  span: Span;
  replacement: string;
}

// Fix bundles one or more edits under a single UX action.
export interface Fix {
  title: string;
  edits: TextEdit[];
  safety: "safe" | "unsafe";
}

// Diagnostic is the single cross-pipeline error payload.
// Every compiler phase emits this shape so rendering is centralized.
export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  primary: Label;
  secondary: Label[];
  notes: string[];
  fixes: Fix[];
}

// Stable code-space partitioning.
// This prevents collisions once we add more passes and tools.
export const DiagnosticRanges = {
  lexer: "E1xxx",
  parser: "E2xxx",
  alias: "E3xxx",
  typeAndDreg: "E4xxx",
  moduleAndFfi: "E5xxx",
  modeGuard: "E6xxx",
  irAndCodegen: "E7xxx",
  llvmInterop: "E8xxx",
  packageManager: "E9xxx",
  warning: "W1xxx",
  lint: "L1xxx",
} as const;

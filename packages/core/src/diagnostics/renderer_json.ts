import type { Diagnostic } from "./diagnostic.js";

// Machine-friendly renderer used by automation and snapshot tests.
export function renderDiagnosticsJson(diags: Diagnostic[]): string {
  return JSON.stringify(diags, null, 2);
}

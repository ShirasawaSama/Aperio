import type { Diagnostic, TextEdit } from "@aperio/diagnostics";

export interface ApplyFixOptions {
  includeUnsafe?: boolean;
}

// Applies safe fixes in descending offset order to keep spans stable.
export function applyFixes(
  source: string,
  diagnostics: Diagnostic[],
  options: ApplyFixOptions = {},
): string {
  const edits: TextEdit[] = [];
  for (const diag of diagnostics) {
    for (const fix of diag.fixes) {
      if (fix.safety === "unsafe" && !options.includeUnsafe) {
        continue;
      }
      edits.push(...fix.edits);
    }
  }
  edits.sort((a, b) => b.span.start - a.span.start);
  let out = source;
  for (const edit of edits) {
    out = out.slice(0, edit.span.start) + edit.replacement + out.slice(edit.span.end);
  }
  return out;
}

import type { FileUnit } from "@aperio/ast";
import type { Diagnostic, Severity } from "@aperio/diagnostics";

export interface LintContext {
  readonly filePath: string;
}

export interface LintRule {
  id: string;
  description: string;
  defaultSeverity: Severity;
  docs: string;
  run(ctx: LintContext, file: FileUnit): Diagnostic[];
}

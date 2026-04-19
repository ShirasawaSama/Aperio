import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

export interface SemanticResult {
  file: FileUnit;
  diagnostics: Diagnostic[];
}

// Shared pass context. Later we can inject symbol tables and type environments.
export class SemanticContext {
  public readonly diagnostics: Diagnostic[] = [];

  public constructor(public readonly file: FileUnit) {}

  public push(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }
}

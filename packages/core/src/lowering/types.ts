import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

export interface LoweringOptions {
  // Keep room for target/profile knobs without changing API shape.
  target?: "win-x64" | "linux-x64" | "generic";
}

export interface LoweringContext {
  source: FileUnit;
  options?: LoweringOptions;
}

export interface LoweringResult<TOutput> {
  output?: TOutput;
  diagnostics: Diagnostic[];
}

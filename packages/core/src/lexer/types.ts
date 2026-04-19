import type { Diagnostic } from "@aperio/diagnostics";
import type { Token } from "./token.js";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

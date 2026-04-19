import { scanTokens } from "./scanner.js";
import type { LexResult } from "./types.js";

export function lex(fileId: number, source: string): LexResult {
  return scanTokens(fileId, source);
}

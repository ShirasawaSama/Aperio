import type { Token } from "@aperio/lexer";
import { parseFnDecl, parseImportDecl } from "./rules/index.js";
import { ParserState } from "./state.js";
import type { ParseResult } from "./types.js";

// Recursive-descent parser skeleton.
// v1 target: parse import lines and minimal fn declarations.
export function parseFile(path: string, tokens: Token[]): ParseResult {
  const state = new ParserState(path, tokens);
  while (state.index < state.tokens.length && !state.at("Eof")) {
    if (state.matchNewline()) {
      continue;
    }
    if (state.matchKeyword("import")) {
      const node = parseImportDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.peekKeyword("pub") || state.peekKeyword("fn")) {
      const node = parseFnDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    state.unsupported("top-level syntax is not implemented yet");
  }
  return { file: state.fileUnit(), diagnostics: state.diagnostics };
}

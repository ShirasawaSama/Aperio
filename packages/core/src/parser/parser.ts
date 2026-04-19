import type { Token } from "@aperio/lexer";
import {
  parseConstDecl,
  parseExternFnDecl,
  parseFileAliasDecl,
  parseFnDecl,
  parseImportDecl,
  parseMacroDecl,
  parseStructDecl,
  parseTypeAliasDecl,
  parseValDecl,
  parseVarDecl,
} from "./rules/index.js";
import { recoverIndex } from "./recovery.js";
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
    // Consume top-level visibility modifiers for declarations that store no visibility in AST yet.
    state.matchKeyword("pub");
    state.matchKeyword("export");

    if (state.matchKeyword("import")) {
      const node = parseImportDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("const")) {
      const node = parseConstDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("val")) {
      const node = parseValDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("var")) {
      const node = parseVarDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("type")) {
      const node = parseTypeAliasDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("struct")) {
      const node = parseStructDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("macro")) {
      const node = parseMacroDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("alias")) {
      const node = parseFileAliasDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.peekKeyword("extern")) {
      const node = parseExternFnDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.peekKeyword("fn")) {
      const node = parseFnDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    const tk = state.current();
    state.error(tk, "E2005", "unsupported top-level declaration");
    state.index = Math.min(recoverIndex(state.tokens, state.index + 1), state.tokens.length - 1);
  }
  return { file: state.fileUnit(), diagnostics: state.diagnostics };
}

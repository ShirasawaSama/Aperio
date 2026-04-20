import type { Token } from "@aperio/lexer";
import type { Attribute } from "@aperio/ast";
import {
  parseAttributeList,
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
import type { ParseFileOptions, ParseResult } from "./types.js";

function rejectOrphanAttributes(state: ParserState, attrs: Attribute[]): void {
  if (attrs.length === 0) {
    return;
  }
  const first = attrs[0];
  if (!first) {
    return;
  }
  state.diagnostics.push({
    code: "E2028",
    severity: "error",
    message: "attributes are not supported on this declaration",
    primary: {
      span: first.span,
      message: "use attributes only on `extern fn` or `fn` declarations (e.g. #[name=\"WriteFile\"] extern fn write_file(...))",
    },
    secondary: [],
    notes: [],
    fixes: [],
  });
}

// Recursive-descent parser skeleton.
// v1 target: parse import lines and minimal fn declarations.
export function parseFile(path: string, tokens: Token[], options?: ParseFileOptions): ParseResult {
  const state = new ParserState(path, tokens, options?.nextNodeIdStart);
  while (state.index < state.tokens.length && !state.at("Eof")) {
    if (state.matchNewline()) {
      continue;
    }
    // Consume top-level visibility modifiers for declarations that store no visibility in AST yet.
    state.matchKeyword("pub");
    state.matchKeyword("export");

    const leadingAttrs = parseAttributeList(state);
    while (state.matchNewline()) {
      // allow attributes on the line above `extern fn` / `fn`
    }

    if (state.matchKeyword("import")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseImportDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("const")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseConstDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("val")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseValDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("var")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseVarDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("type")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseTypeAliasDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("struct")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseStructDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("macro")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseMacroDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.matchKeyword("alias")) {
      rejectOrphanAttributes(state, leadingAttrs);
      const node = parseFileAliasDecl(state);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.peekKeyword("extern")) {
      const node = parseExternFnDecl(state, leadingAttrs);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    if (state.peekKeyword("fn")) {
      const node = parseFnDecl(state, leadingAttrs);
      if (node) {
        state.items.push(node);
      }
      continue;
    }
    rejectOrphanAttributes(state, leadingAttrs);
    const tk = state.current();
    state.error(tk, "E2005", "unsupported top-level declaration");
    state.index = Math.min(recoverIndex(state.tokens, state.index + 1), state.tokens.length - 1);
  }
  return {
    file: state.fileUnit(),
    diagnostics: state.diagnostics,
    nextNodeIdExclusive: state.nextNodeId,
  };
}

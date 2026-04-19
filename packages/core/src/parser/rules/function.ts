import type { ExternFnDecl, FnDecl, SlotBinding, Stmt } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parseStmt } from "./stmt.js";
import { parseSlotBinding, parseSlotBindingList } from "./shared.js";

// Parse function declarations with v1 strict signature subset:
// `pub? fn name(params) -> returns uses (...) { body }`
export function parseFnDecl(state: ParserState): FnDecl | undefined {
  const start = state.current()?.span.start ?? 0;
  state.matchKeyword("pub");
  if (!state.matchKeyword("fn")) {
    state.error(state.current(), "E2003", "expected 'fn'");
    return undefined;
  }
  const name = state.parseIdent("expected function name");
  if (!name) {
    return undefined;
  }

  const params = parseSlotBindingList(state, "expected '(' to start function parameters");
  if (!params) {
    return undefined;
  }

  const returns = parseReturnBindings(state) ?? [];
  const uses = parseUsesBindings(state) ?? [];

  if (!state.matchSymbol("{")) {
    state.error(state.current(), "E2004", "expected '{' to start function body");
    return undefined;
  }

  const body: Stmt[] = [];
  while (!state.at("Eof") && !state.matchSymbol("}")) {
    if (state.matchNewline()) {
      continue;
    }
    const stmt = parseStmt(state);
    if (stmt) {
      body.push(stmt);
      continue;
    }
    // Fail-safe to avoid parser stalls on unknown syntax.
    state.unsupported("unsupported statement in function body");
  }

  const end = state.previous()?.span.end ?? start;
  return {
    id: state.id(),
    kind: "FnDecl",
    span: span(state.fileId, start, end),
    name,
    params,
    returns,
    uses,
    attrs: [],
    body,
  };
}

export function parseExternFnDecl(state: ParserState): ExternFnDecl | undefined {
  const start = state.current()?.span.start ?? 0;
  state.matchKeyword("pub");
  if (!state.matchKeyword("extern")) {
    state.error(state.current(), "E2020", "expected 'extern'");
    return undefined;
  }
  if (!state.matchKeyword("fn")) {
    state.error(state.current(), "E2003", "expected 'fn' after 'extern'");
    return undefined;
  }
  const name = state.parseIdent("expected extern function name");
  if (!name) {
    return undefined;
  }
  const params = parseSlotBindingList(state, "expected '(' to start extern function parameters");
  if (!params) {
    return undefined;
  }
  const returns = parseReturnBindings(state) ?? [];
  const variadic = false;
  const end = state.previous()?.span.end ?? start;
  return {
    id: state.id(),
    kind: "ExternFnDecl",
    span: span(state.fileId, start, end),
    name,
    params,
    returns,
    variadic,
    attrs: [],
  };
}

function parseReturnBindings(state: ParserState): SlotBinding[] | undefined {
  if (!state.matchSymbolSequence("-", ">")) {
    return undefined;
  }
  if (state.checkSymbol("(")) {
    return parseSlotBindingList(state, "expected '(' after '->'") ?? [];
  }
  const single = parseSlotBinding(state);
  return single ? [single] : [];
}

function parseUsesBindings(state: ParserState): SlotBinding[] | undefined {
  if (!state.matchKeyword("uses")) {
    return undefined;
  }
  if (state.checkSymbol("(")) {
    return parseSlotBindingList(state, "expected '(' after uses") ?? [];
  }
  const one = parseSlotBinding(state);
  return one ? [one] : [];
}

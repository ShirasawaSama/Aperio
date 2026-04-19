import type { FnDecl, SlotBinding } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";

// Parse minimal v1 function declarations: `pub? fn name() { ... }`.
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

  if (!state.matchSymbol("(")) {
    state.unsupported("function parameters are not implemented yet");
    return undefined;
  }
  if (!state.matchSymbol(")")) {
    state.unsupported("function parameters are not implemented yet");
    return undefined;
  }

  if (!state.matchSymbol("{")) {
    state.error(state.current(), "E2004", "expected '{' to start function body");
    return undefined;
  }
  while (!state.at("Eof") && !state.matchSymbol("}")) {
    if (state.matchNewline()) {
      continue;
    }
    state.unsupported("function statement parsing is not implemented yet");
  }

  const end = state.previous()?.span.end ?? start;
  return {
    id: state.id(),
    kind: "FnDecl",
    span: span(state.fileId, start, end),
    name,
    params: [] as SlotBinding[],
    returns: [],
    uses: [],
    attrs: [],
    body: [],
  };
}

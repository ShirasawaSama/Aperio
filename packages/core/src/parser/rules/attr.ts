import type { Attribute } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parseExpr } from "./expr.js";

/** Parses zero or more `#[name = value]` attributes (leading form). */
export function parseAttributeList(state: ParserState): Attribute[] {
  const list: Attribute[] = [];
  while (state.checkSymbol("#") && state.checkSymbol("[", 1)) {
    const hashTk = state.current();
    if (!hashTk) {
      break;
    }
    const astart = hashTk.span.start;
    state.matchSymbol("#");
    if (!state.consumeSymbol("[", "expected '[' after '#' in attribute")) {
      break;
    }
    const name = state.parseIdent("expected attribute name");
    if (!name) {
      break;
    }
    if (!state.consumeSymbol("=", "expected '=' in attribute")) {
      break;
    }
    const val = parseExpr(state);
    if (!val) {
      state.error(state.current(), "E2029", "expected value expression in attribute");
      break;
    }
    if (!state.consumeSymbol("]", "expected ']' after attribute")) {
      break;
    }
    const end = state.previous().span.end;
    list.push({
      id: state.id(),
      kind: "Attribute",
      span: span(state.fileId, astart, end),
      name,
      args: [val],
    });
  }
  return list;
}

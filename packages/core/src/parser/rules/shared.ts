import type { Ident, RegRefExpr, SlotBinding, TuplePattern, TypeExpr } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";

const SLOT_NAME_RE = /^r\d+$|^f\d+$/;

export function parseTypeExpr(state: ParserState): TypeExpr | undefined {
  const start = state.current()?.span.start ?? state.previous().span.start;
  if (state.matchKeyword("fn")) {
    return parseFnTypeExpr(state, start);
  }
  if (state.matchSymbol("*")) {
    const base = parseTypeExpr(state);
    if (!base) {
      state.error(state.current(), "E2015", "expected pointed type after '*'");
      return undefined;
    }
    return {
      id: state.id(),
      kind: "TypeExpr",
      span: span(state.fileId, start, base.span.end),
      typeKind: "ptr",
      name: "*",
      params: [base],
    };
  }

  const name = parsePathIdent(state, "expected type name");
  if (!name) {
    return undefined;
  }
  const withArray = parseTypeArraySuffix(state, name.text);
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "TypeExpr",
    span: span(state.fileId, name.span.start, end),
    typeKind: "named",
    name: withArray,
  };
}

export function parsePathIdent(state: ParserState, message: string): Ident | undefined {
  const head = state.consume((t) => t.kind === "Ident", message);
  if (!head) {
    return undefined;
  }
  let text = head.text;
  let end = head.span.end;
  while (state.matchSymbolSequence(":", ":")) {
    const seg = state.consume((t) => t.kind === "Ident", "expected identifier after '::'");
    if (!seg) {
      break;
    }
    text += `::${seg.text}`;
    end = seg.span.end;
  }
  return {
    id: state.id(),
    kind: "Ident",
    span: span(state.fileId, head.span.start, end),
    text,
  };
}

export function parseSlotBinding(state: ParserState): SlotBinding | undefined {
  const startToken = state.consume((t) => t.kind === "Ident", "expected slot binding");
  if (!startToken) {
    return undefined;
  }

  let alias: Ident;
  let slot: RegRefExpr;

  if (state.matchSymbol("@")) {
    alias = {
      id: state.id(),
      kind: "Ident",
      span: startToken.span,
      text: startToken.text,
    };
    const slotToken = state.consume((t) => t.kind === "Ident", "expected register slot after '@'");
    if (!slotToken || !SLOT_NAME_RE.test(slotToken.text)) {
      state.error(slotToken, "E2011", "expected register slot like r0/f0");
      return undefined;
    }
    slot = {
      id: state.id(),
      kind: "RegRefExpr",
      span: slotToken.span,
      name: slotToken.text,
    };
  } else {
    if (!SLOT_NAME_RE.test(startToken.text)) {
      state.error(startToken, "E2011", "expected register slot like r0/f0");
      return undefined;
    }
    alias = {
      id: state.id(),
      kind: "Ident",
      span: startToken.span,
      text: startToken.text,
    };
    slot = {
      id: state.id(),
      kind: "RegRefExpr",
      span: startToken.span,
      name: startToken.text,
    };
  }

  let type: TypeExpr | undefined;
  if (state.matchSymbol(":")) {
    type = parseTypeExpr(state);
  }

  const end = type?.span.end ?? slot.span.end;
  return {
    id: state.id(),
    kind: "SlotBinding",
    span: span(state.fileId, startToken.span.start, end),
    alias,
    slot,
    type,
  };
}

export function parseSlotBindingList(state: ParserState, message: string): SlotBinding[] | undefined {
  if (!state.consumeSymbol("(", message)) {
    return undefined;
  }
  const items: SlotBinding[] = [];
  while (!state.at("Eof")) {
    if (state.matchSymbol(")")) {
      break;
    }
    const binding = parseSlotBinding(state);
    if (!binding) {
      return undefined;
    }
    items.push(binding);
    if (state.matchSymbol(")")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2012", "expected ',' or ')' in slot binding list");
      return undefined;
    }
  }
  return items;
}

export function parseTuplePattern(state: ParserState): TuplePattern | undefined {
  const open = state.consumeSymbol("(", "expected '(' to start tuple assignment");
  if (!open) {
    return undefined;
  }
  const items: RegRefExpr[] = [];
  while (!state.at("Eof")) {
    const tk = state.consume((t) => t.kind === "Ident", "expected register in tuple pattern");
    if (!tk) {
      return undefined;
    }
    items.push({
      id: state.id(),
      kind: "RegRefExpr",
      span: tk.span,
      name: tk.text,
    });
    if (state.matchSymbol(")")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2013", "expected ',' or ')' in tuple pattern");
      return undefined;
    }
  }
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "TuplePattern",
    span: span(state.fileId, open.span.start, end),
    items,
  };
}

function parseFnTypeExpr(state: ParserState, start: number): TypeExpr | undefined {
  state.consumeSymbol("(", "expected '(' after fn in function type");
  const params: TypeExpr[] = [];
  while (!state.at("Eof")) {
    if (state.matchSymbol(")")) {
      break;
    }
    // Support both `r1: i64` and plain `i64` in type signatures.
    if (state.current()?.kind === "Ident" && state.checkSymbol(":", 1)) {
      state.index += 1;
      state.index += 1;
    }
    const ty = parseTypeExpr(state);
    if (!ty) {
      return undefined;
    }
    params.push(ty);
    if (state.matchSymbol(")")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2023", "expected ',' or ')' in function type parameter list");
      return undefined;
    }
  }

  const returns: TypeExpr[] = [];
  if (state.matchSymbolSequence("-", ">")) {
    if (state.matchSymbol("(")) {
      while (!state.at("Eof")) {
        if (state.matchSymbol(")")) {
          break;
        }
        if (state.current()?.kind === "Ident" && state.checkSymbol(":", 1)) {
          state.index += 1;
          state.index += 1;
        }
        const retTy = parseTypeExpr(state);
        if (!retTy) {
          return undefined;
        }
        returns.push(retTy);
        if (state.matchSymbol(")")) {
          break;
        }
        if (!state.matchSymbol(",")) {
          state.error(state.current(), "E2024", "expected ',' or ')' in function type return list");
          return undefined;
        }
      }
    } else {
      const single = parseTypeExpr(state);
      if (!single) {
        return undefined;
      }
      returns.push(single);
    }
  }

  const all = [...params, ...returns];
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "TypeExpr",
    span: span(state.fileId, start, end),
    typeKind: "fn",
    name: "fn",
    params: all,
  };
}

function parseTypeArraySuffix(state: ParserState, baseName: string): string {
  let name = baseName;
  while (state.matchSymbol("[")) {
    const parts: string[] = [];
    while (!state.at("Eof") && !state.matchSymbol("]")) {
      const tk = state.current();
      if (!tk) {
        break;
      }
      parts.push(tk.text);
      state.index += 1;
    }
    name += `[${parts.join("")}]`;
  }
  return name;
}

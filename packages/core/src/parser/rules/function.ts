import type { Attribute, ExternFnDecl, FnDecl, SlotBinding, Stmt } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { recoverIndex } from "../recovery.js";
import { parseStmt } from "./stmt.js";
import { parseSlotBinding, parseSlotBindingList, parseTypeExpr } from "./shared.js";

// Parse function declarations with v1 strict signature subset:
// `pub? fn name(params) -> returns uses (...) { body }`
export function parseFnDecl(state: ParserState, leadingAttrs: Attribute[] = []): FnDecl | undefined {
  const start = leadingAttrs[0]?.span.start ?? state.current()?.span.start ?? 0;
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
    const tk = state.current();
    state.error(tk, "E2016", "unsupported statement in function body");
    state.index = Math.min(recoverIndex(state.tokens, state.index + 1), state.tokens.length - 1);
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
    attrs: [...leadingAttrs],
    body,
  };
}

export function parseExternFnDecl(state: ParserState, leadingAttrs: Attribute[] = []): ExternFnDecl | undefined {
  const start = leadingAttrs[0]?.span.start ?? state.current()?.span.start ?? 0;
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
  const parsedParams = parseExternParams(state);
  if (!parsedParams) {
    return undefined;
  }
  const { params, variadic } = parsedParams;
  const returns = parseExternReturns(state) ?? [];
  const end = state.previous()?.span.end ?? start;
  return {
    id: state.id(),
    kind: "ExternFnDecl",
    span: span(state.fileId, start, end),
    name,
    params,
    returns,
    variadic,
    attrs: [...leadingAttrs],
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
    state.consumeSymbol("(", "expected '(' after uses");
    const items: SlotBinding[] = [];
    while (!state.at("Eof")) {
      if (state.matchSymbol(")")) {
        break;
      }
      const parsed = parseUsesItem(state);
      if (!parsed) {
        return undefined;
      }
      items.push(...parsed);
      if (state.matchSymbol(")")) {
        break;
      }
      if (!state.matchSymbol(",")) {
        state.error(state.current(), "E2028", "expected ',' or ')' in uses list");
        return undefined;
      }
    }
    return items;
  }
  return parseUsesItem(state);
}

function parseExternParams(
  state: ParserState,
): { params: SlotBinding[]; variadic: boolean } | undefined {
  if (!state.consumeSymbol("(", "expected '(' to start extern function parameters")) {
    return undefined;
  }
  const params: SlotBinding[] = [];
  let variadic = false;
  while (!state.at("Eof")) {
    while (state.matchNewline()) {
      // allow multiline extern parameter lists
    }
    if (state.matchSymbol(")")) {
      break;
    }
    if (state.matchSymbolSequence(".", ".", ".")) {
      variadic = true;
      state.consumeSymbol(")", "expected ')' after variadic marker");
      break;
    }
    params.push(parseExternParam(state, params.length));
    while (state.matchNewline()) {
      // allow newline before separator
    }
    if (state.matchSymbol(")")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2026", "expected ',' or ')' in extern parameter list");
      return undefined;
    }
  }
  return { params, variadic };
}

function parseExternParam(state: ParserState, index: number): SlotBinding {
  const start = state.current()?.span.start ?? state.previous().span.end;
  const first = state.consume(
    (t) => t.kind === "Ident",
    "expected extern parameter name or register slot",
  );
  if (!first) {
    return fakeBinding(state, `arg${index}`, `r${index}`, start);
  }

  if (!state.checkSymbol(":")) {
    // Backward-compatible fallback to strict slot binding style.
    state.index -= 1;
    return parseSlotBinding(state) ?? fakeBinding(state, `arg${index}`, `r${index}`, start);
  }

  state.index += 1; // consume ":"
  const type = parseTypeExpr(state);
  const end = type?.span.end ?? first.span.end;
  return {
    id: state.id(),
    kind: "SlotBinding",
    span: span(state.fileId, first.span.start, end),
    alias: {
      id: state.id(),
      kind: "Ident",
      span: first.span,
      text: first.text,
    },
    // Keep AST compatibility for now: use the parameter name as pseudo slot.
    slot: {
      id: state.id(),
      kind: "RegRefExpr",
      span: first.span,
      name: first.text,
    },
    ...(type ? { type } : {}),
  };
}

function parseExternReturns(state: ParserState): SlotBinding[] | undefined {
  if (!state.matchSymbolSequence("-", ">")) {
    return undefined;
  }
  if (state.matchSymbol("(")) {
    const items: SlotBinding[] = [];
    while (!state.at("Eof")) {
      while (state.matchNewline()) {
        // allow multiline extern return lists
      }
      if (state.matchSymbol(")")) {
        break;
      }
      items.push(parseExternReturnItem(state, items.length));
      while (state.matchNewline()) {
        // allow newline before separator
      }
      if (state.matchSymbol(")")) {
        break;
      }
      if (!state.matchSymbol(",")) {
        state.error(state.current(), "E2027", "expected ',' or ')' in extern return list");
        return undefined;
      }
    }
    return items;
  }
  return [parseExternReturnItem(state, 0)];
}

function parseExternReturnItem(state: ParserState, index: number): SlotBinding {
  const first = state.current();
  if (!first) {
    return fakeBinding(state, index === 0 ? "ret" : `ret${index}`, `r${index}`, 0);
  }
  if (first.kind === "Ident" && state.checkSymbol(":", 1)) {
    return parseExternParam(state, index);
  }
  const ty = parseTypeExpr(state);
  if (!ty) {
    return fakeBinding(state, index === 0 ? "ret" : `ret${index}`, `r${index}`, first.span.start);
  }
  const slotName = index === 0 ? "r0" : `r${index}`;
  return {
    id: state.id(),
    kind: "SlotBinding",
    span: ty.span,
    alias: {
      id: state.id(),
      kind: "Ident",
      span: ty.span,
      text: index === 0 ? "ret" : `ret${index}`,
    },
    slot: {
      id: state.id(),
      kind: "RegRefExpr",
      span: ty.span,
      name: slotName,
    },
    type: ty,
  };
}

function fakeBinding(state: ParserState, name: string, slot: string, start: number): SlotBinding {
  const fakeSpan = span(state.fileId, start, start);
  return {
    id: state.id(),
    kind: "SlotBinding",
    span: fakeSpan,
    alias: { id: state.id(), kind: "Ident", span: fakeSpan, text: name },
    slot: { id: state.id(), kind: "RegRefExpr", span: fakeSpan, name: slot },
  };
}

function parseUsesItem(state: ParserState): SlotBinding[] | undefined {
  const single = parseSlotBinding(state);
  if (!single) {
    return undefined;
  }
  // ranges apply only to raw register-like aliases: r3..=r10 / r3..r10.
  if (!state.matchSymbolSequence(".", ".")) {
    return [single];
  }
  const inclusive = state.matchSymbol("=");
  const endTk = state.consume((t) => t.kind === "Ident", "expected range end register in uses");
  if (!endTk) {
    return [single];
  }
  const expanded = expandRegisterRange(single.slot.name, endTk.text, inclusive);
  if (!expanded) {
    state.error(endTk, "E2029", "invalid uses register range");
    return [single];
  }
  return expanded.map((name) => makeUsesBinding(state, name, single.span.start));
}

function expandRegisterRange(start: string, end: string, inclusive: boolean): string[] | undefined {
  const startMatch = /^([rf])(\d+)$/.exec(start);
  const endMatch = /^([rf])(\d+)$/.exec(end);
  if (!startMatch || !endMatch) {
    return undefined;
  }
  const startClass = startMatch[1];
  const endClass = endMatch[1];
  if (startClass !== endClass) {
    return undefined;
  }
  const startNum = Number.parseInt(startMatch[2] ?? "", 10);
  const endNumRaw = Number.parseInt(endMatch[2] ?? "", 10);
  const endNum = inclusive ? endNumRaw : endNumRaw - 1;
  if (Number.isNaN(startNum) || Number.isNaN(endNumRaw) || startNum > endNum) {
    return undefined;
  }
  const result: string[] = [];
  for (let i = startNum; i <= endNum; i += 1) {
    result.push(`${startClass}${i}`);
  }
  return result;
}

function makeUsesBinding(state: ParserState, slotName: string, start: number): SlotBinding {
  const s = span(state.fileId, start, start);
  return {
    id: state.id(),
    kind: "SlotBinding",
    span: s,
    alias: {
      id: state.id(),
      kind: "Ident",
      span: s,
      text: slotName,
    },
    slot: {
      id: state.id(),
      kind: "RegRefExpr",
      span: s,
      name: slotName,
    },
  };
}

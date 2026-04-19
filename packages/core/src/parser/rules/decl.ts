import type {
  ConstDecl,
  Ident,
  MacroDecl,
  MacroParam,
  StructDecl,
  StructField,
  TypeAliasDecl,
  ValDecl,
  VarDecl,
} from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parseExpr } from "./expr.js";
import { parsePathIdent, parseTypeExpr } from "./shared.js";

export function parseConstDecl(state: ParserState): ConstDecl | undefined {
  const start = state.previous().span.start;
  const name = parsePathIdent(state, "expected const name");
  if (!name) {
    return undefined;
  }
  state.consumeSymbol(":", "expected ':' after const name");
  const type = parseTypeExpr(state);
  if (!type) {
    return undefined;
  }
  state.consumeSymbol("=", "expected '=' in const declaration");
  const value = parseExpr(state);
  if (!value) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "ConstDecl",
    span: span(state.fileId, start, value.span.end),
    name,
    type,
    value,
  };
}

export function parseValDecl(state: ParserState): ValDecl | undefined {
  return parseDataDecl(state, "ValDecl");
}

export function parseVarDecl(state: ParserState): VarDecl | undefined {
  return parseDataDecl(state, "VarDecl");
}

export function parseTypeAliasDecl(state: ParserState): TypeAliasDecl | undefined {
  const start = state.previous().span.start;
  const name = parsePathIdent(state, "expected type alias name");
  if (!name) {
    return undefined;
  }
  state.consumeSymbol("=", "expected '=' in type alias declaration");
  const target = parseTypeExpr(state);
  if (!target) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "TypeAliasDecl",
    span: span(state.fileId, start, target.span.end),
    name,
    target,
  };
}

export function parseStructDecl(state: ParserState): StructDecl | undefined {
  const start = state.previous().span.start;
  const name = parsePathIdent(state, "expected struct name");
  if (!name) {
    return undefined;
  }
  state.consumeSymbol("{", "expected '{' after struct name");
  const fields: StructField[] = [];
  while (!state.at("Eof")) {
    state.matchNewline();
    if (state.matchSymbol("}")) {
      break;
    }
    const fieldName = state.parseIdent("expected struct field name");
    if (!fieldName) {
      return undefined;
    }
    state.consumeSymbol(":", "expected ':' after struct field name");
    const fieldType = parseTypeExpr(state);
    if (!fieldType) {
      return undefined;
    }
    fields.push({
      id: state.id(),
      kind: "StructField",
      span: span(state.fileId, fieldName.span.start, fieldType.span.end),
      name: fieldName,
      type: fieldType,
    });
    state.matchSymbol(",");
    state.matchNewline();
  }
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "StructDecl",
    span: span(state.fileId, start, end),
    name,
    fields,
  };
}

export function parseMacroDecl(state: ParserState): MacroDecl | undefined {
  const start = state.previous().span.start;
  const name = parsePathIdent(state, "expected macro name");
  if (!name) {
    return undefined;
  }
  state.matchSymbol("!");
  state.consumeSymbol("(", "expected '(' after macro name");
  const params: MacroParam[] = [];
  while (!state.at("Eof")) {
    if (state.matchSymbol(")")) {
      break;
    }
    const paramName = parseMacroParamName(state);
    if (!paramName) {
      return undefined;
    }
    state.consumeSymbol(":", "expected ':' after macro parameter name");
    const fragment = state.consume(
      (t) => t.kind === "Ident" || t.kind === "Keyword",
      "expected macro fragment kind",
    );
    if (!fragment) {
      return undefined;
    }
    params.push({
      id: state.id(),
      kind: "MacroParam",
      span: span(state.fileId, paramName.span.start, fragment.span.end),
      name: paramName,
      fragment: fragment.text,
    });
    if (state.matchSymbol(")")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2022", "expected ',' or ')' in macro parameter list");
      return undefined;
    }
  }
  state.consumeSymbol("{", "expected '{' to start macro body");
  skipBalancedBlock(state);
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "MacroDecl",
    span: span(state.fileId, start, end),
    name,
    params,
    body: [],
  };
}

type DataDeclKind = "ValDecl" | "VarDecl";

function parseDataDecl(state: ParserState, kind: DataDeclKind): ValDecl | VarDecl | undefined {
  const start = state.previous().span.start;
  const name = parsePathIdent(state, `expected ${kind === "ValDecl" ? "val" : "var"} name`);
  if (!name) {
    return undefined;
  }
  state.consumeSymbol(":", "expected ':' after data symbol name");
  const type = parseTypeExpr(state);
  if (!type) {
    return undefined;
  }
  let init;
  if (state.matchSymbol("=")) {
    init = parseExpr(state);
  } else if (kind === "ValDecl") {
    state.error(state.current(), "E2025", "val declaration requires an initializer");
  }
  const end = init?.span.end ?? type.span.end;
  if (kind === "ValDecl") {
    const node: ValDecl = {
      id: state.id(),
      kind: "ValDecl",
      span: span(state.fileId, start, end),
      name,
      type,
      ...(init ? { init } : {}),
    };
    return node;
  }
  const node: VarDecl = {
    id: state.id(),
    kind: "VarDecl",
    span: span(state.fileId, start, end),
    name,
    type,
    ...(init ? { init } : {}),
  };
  return node;
}

function parseMacroParamName(state: ParserState): Ident | undefined {
  const dollar = state.current();
  if (dollar?.kind === "Symbol" && dollar.text === "$") {
    state.index += 1;
  }
  return state.parseIdent("expected macro parameter name");
}

function skipBalancedBlock(state: ParserState): void {
  let depth = 1;
  while (!state.at("Eof") && depth > 0) {
    const tk = state.current();
    if (!tk) {
      break;
    }
    state.index += 1;
    if (tk.kind === "Symbol" && tk.text === "{") {
      depth += 1;
      continue;
    }
    if (tk.kind === "Symbol" && tk.text === "}") {
      depth -= 1;
    }
  }
}

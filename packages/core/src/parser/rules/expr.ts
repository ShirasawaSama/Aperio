import type {
  ArrayLiteralExpr,
  BinaryExpr,
  CallArg,
  CallExpr,
  Expr,
  IdentExpr,
  LiteralExpr,
  RegRefExpr,
} from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parsePathIdent, parseTypeExpr } from "./shared.js";

const REG_NAME_RE = /^r\d+$|^f\d+$/;

// Expression parser (v1 core subset):
// literals, register/identifier refs, calls with named args, unary/binary ops, casts.
export function parseExpr(state: ParserState): Expr | undefined {
  return parseCastExpr(state);
}

function parseCastExpr(state: ParserState): Expr | undefined {
  let expr = parseComparisonExpr(state);
  if (!expr) {
    return undefined;
  }
  while (state.matchKeyword("as")) {
    const ty = parseTypeExpr(state);
    if (!ty) {
      return undefined;
    }
    expr = {
      id: state.id(),
      kind: "CastExpr",
      span: span(state.fileId, expr.span.start, ty.span.end),
      value: expr,
      type: ty,
    };
  }
  return expr;
}

function parseComparisonExpr(state: ParserState): Expr | undefined {
  let left = parseAdditiveExpr(state);
  if (!left) {
    return undefined;
  }
  while (true) {
    const op = matchComparisonOp(state);
    if (!op) {
      break;
    }
    const right = parseAdditiveExpr(state);
    if (!right) {
      return left;
    }
    left = makeBinary(state, left, op, right);
  }
  return left;
}

function parseAdditiveExpr(state: ParserState): Expr | undefined {
  let left = parseMultiplicativeExpr(state);
  if (!left) {
    return undefined;
  }
  while (true) {
    const op = state.matchSymbol("+") ? "+" : state.matchSymbol("-") ? "-" : undefined;
    if (!op) {
      break;
    }
    const right = parseMultiplicativeExpr(state);
    if (!right) {
      return left;
    }
    left = makeBinary(state, left, op, right);
  }
  return left;
}

function parseMultiplicativeExpr(state: ParserState): Expr | undefined {
  let left = parseUnaryExpr(state);
  if (!left) {
    return undefined;
  }
  while (true) {
    const op = state.matchSymbol("*") ? "*" : state.matchSymbol("/") ? "/" : undefined;
    if (!op) {
      break;
    }
    const right = parseUnaryExpr(state);
    if (!right) {
      return left;
    }
    left = makeBinary(state, left, op, right);
  }
  return left;
}

function parseUnaryExpr(state: ParserState): Expr | undefined {
  const start = state.current()?.span.start ?? state.previous().span.end;
  const op = state.matchSymbol("-")
    ? "-"
    : state.matchSymbol("!")
      ? "!"
      : state.matchSymbol("&")
        ? "&"
        : undefined;
  if (!op) {
    return parsePostfixExpr(state);
  }
  const value = parseUnaryExpr(state);
  if (!value) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "UnaryExpr",
    span: span(state.fileId, start, value.span.end),
    op,
    value,
  };
}

function parsePostfixExpr(state: ParserState): Expr | undefined {
  let expr = parsePrimaryExpr(state);
  if (!expr) {
    return undefined;
  }
  while (state.checkSymbol("(")) {
    expr = parseCallExpr(state, expr);
  }
  return expr;
}

function parsePrimaryExpr(state: ParserState): Expr | undefined {
  const tk = state.current();
  if (!tk) {
    return undefined;
  }
  if (state.checkSymbol("[")) {
    return parseArrayLiteral(state);
  }
  if (state.matchSymbol("(")) {
    const inner = parseExpr(state);
    if (!inner) {
      return undefined;
    }
    state.consumeSymbol(")", "expected ')' after grouped expression");
    return inner;
  }
  if (tk.kind === "IntLiteral") {
    state.index += 1;
    const node: LiteralExpr = {
      id: state.id(),
      kind: "LiteralExpr",
      span: tk.span,
      literalKind: "int",
      value: tk.text,
    };
    return node;
  }
  if (tk.kind === "StringLiteral") {
    state.index += 1;
    const node: LiteralExpr = {
      id: state.id(),
      kind: "LiteralExpr",
      span: tk.span,
      literalKind: "string",
      value: tk.text,
    };
    return node;
  }
  if (tk.kind === "Ident") {
    const ident = parsePathIdent(state, "expected expression");
    if (!ident) {
      return undefined;
    }
    if (REG_NAME_RE.test(ident.text)) {
      const reg: RegRefExpr = {
        id: state.id(),
        kind: "RegRefExpr",
        span: ident.span,
        name: ident.text,
      };
      return reg;
    }
    const node: IdentExpr = {
      id: state.id(),
      kind: "IdentExpr",
      span: ident.span,
      name: ident,
    };
    return node;
  }
  if (tk.kind === "Keyword" && (tk.text === "true" || tk.text === "false")) {
    state.index += 1;
    const node: LiteralExpr = {
      id: state.id(),
      kind: "LiteralExpr",
      span: tk.span,
      literalKind: "bool",
      value: tk.text,
    };
    return node;
  }
  state.error(tk, "E2014", "expected expression");
  return undefined;
}

function parseArrayLiteral(state: ParserState): ArrayLiteralExpr | undefined {
  const open = state.consumeSymbol("[", "expected '[' to start array literal");
  if (!open) {
    return undefined;
  }
  const items: Expr[] = [];
  while (!state.at("Eof")) {
    if (state.matchSymbol("]")) {
      break;
    }
    const item = parseExpr(state);
    if (!item) {
      return undefined;
    }
    items.push(item);
    if (state.matchSymbol("]")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2021", "expected ',' or ']' in array literal");
      return undefined;
    }
  }
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "ArrayLiteralExpr",
    span: span(state.fileId, open.span.start, end),
    items,
  };
}

function parseCallExpr(state: ParserState, callee: Expr): CallExpr {
  const open = state.consumeSymbol("(", "expected '(' for call arguments");
  const args: CallArg[] = [];
  if (open) {
    while (!state.at("Eof")) {
      if (state.matchSymbol(")")) {
        break;
      }
      const arg = parseCallArg(state);
      if (!arg) {
        break;
      }
      args.push(arg);
      if (state.matchSymbol(")")) {
        break;
      }
      if (!state.matchSymbol(",")) {
        state.error(state.current(), "E2010", "expected ',' or ')' in call arguments");
        break;
      }
    }
  }
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "CallExpr",
    span: span(state.fileId, callee.span.start, end),
    callee,
    args,
  };
}

function parseCallArg(state: ParserState): CallArg | undefined {
  const start = state.current()?.span.start ?? state.previous().span.end;
  const identTk = state.current();
  if (identTk?.kind === "Ident" && state.checkSymbol("=", 1)) {
    const name = state.parseIdent("expected argument name");
    state.consumeSymbol("=", "expected '=' after argument name");
    const value = parseExpr(state);
    if (!value) {
      return undefined;
    }
    const end = value?.span.end ?? state.previous().span.end;
    return {
      id: state.id(),
      kind: "CallArg",
      span: span(state.fileId, start, end),
      ...(name ? { name } : {}),
      value,
    };
  }
  const value = parseExpr(state);
  if (!value) {
    return undefined;
  }
  if (value.kind !== "RegRefExpr" && value.kind !== "IdentExpr") {
    state.error(
      state.current() ?? state.previous(),
      "E2031",
      "non-register call argument must specify a target slot like r1 = <expr>",
    );
    return undefined;
  }
  const end = value?.span.end ?? state.previous().span.end;
  return {
    id: state.id(),
    kind: "CallArg",
    span: span(state.fileId, start, end),
    value,
  };
}

function makeBinary(state: ParserState, left: Expr, op: string, right: Expr): BinaryExpr {
  return {
    id: state.id(),
    kind: "BinaryExpr",
    span: span(state.fileId, left.span.start, right.span.end),
    op,
    left,
    right,
  };
}

function matchComparisonOp(state: ParserState): string | undefined {
  if (state.matchSymbolSequence("=", "=")) {
    return "==";
  }
  if (state.matchSymbolSequence("!", "=")) {
    return "!=";
  }
  if (state.matchSymbolSequence(">", "=")) {
    return ">=";
  }
  if (state.matchSymbolSequence("<", "=")) {
    return "<=";
  }
  if (state.matchSymbol(">")) {
    return ">";
  }
  if (state.matchSymbol("<")) {
    return "<";
  }
  return undefined;
}

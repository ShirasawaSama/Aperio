import type {
  AssignStmt,
  CallStmt,
  Expr,
  FnBodyAliasDecl,
  GotoStmt,
  Ident,
  IfGotoStmt,
  LabelStmt,
  MultiAssignStmt,
  ReturnStmt,
  Stmt,
} from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parseExpr } from "./expr.js";
import { parseSlotBinding, parseTuplePattern } from "./shared.js";

const REG_OR_ALIAS_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Statement parser subset:
// alias/return/goto/if-goto/labels/assignments/multi-assign/call statement.
export function parseStmt(state: ParserState): Stmt | undefined {
  if (state.matchNewline()) {
    return undefined;
  }
  const tk = state.current();
  if (!tk) {
    return undefined;
  }

  if (state.matchKeyword("alias")) {
    return parseFnAliasDecl(state, tk.span.start);
  }
  if (state.matchKeyword("return")) {
    return parseReturnStmt(state, tk.span.start);
  }
  if (state.matchKeyword("goto")) {
    return parseGotoStmt(state, tk.span.start);
  }
  if (state.matchKeyword("if")) {
    return parseIfGotoStmt(state, tk.span.start);
  }
  if ((tk.kind === "Ident" && state.checkSymbol(":", 1)) || (state.checkSymbol("@") && state.peek(1)?.kind === "Ident")) {
    return parseLabelStmt(state);
  }
  if (state.checkSymbol("(")) {
    return parseMultiAssignStmt(state);
  }
  return parseAssignOrCallStmt(state);
}

function parseFnAliasDecl(state: ParserState, start: number): FnBodyAliasDecl | undefined {
  const binding = parseSlotBinding(state);
  if (!binding) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "FnBodyAliasDecl",
    span: span(state.fileId, start, binding.span.end),
    binding,
  };
}

function parseReturnStmt(state: ParserState, start: number): ReturnStmt {
  const values: Expr[] = [];
  while (!state.at("Eof") && !state.at("Newline") && !state.checkSymbol("}")) {
    const value = parseExpr(state);
    if (!value) {
      break;
    }
    values.push(value);
    if (!state.matchSymbol(",")) {
      break;
    }
  }
  const end = values.length > 0 ? values[values.length - 1]?.span.end : state.previous().span.end;
  return {
    id: state.id(),
    kind: "ReturnStmt",
    span: span(state.fileId, start, end),
    values,
  };
}

function parseGotoStmt(state: ParserState, start: number): GotoStmt | undefined {
  const label = parseLabelRef(state, "expected label after 'goto'");
  if (!label) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "GotoStmt",
    span: span(state.fileId, start, label.span.end),
    label,
  };
}

function parseIfGotoStmt(state: ParserState, start: number): IfGotoStmt | undefined {
  const wrapped = state.matchSymbol("(");
  const condition = parseExpr(state);
  if (!condition) {
    return undefined;
  }
  if (wrapped) {
    state.consumeSymbol(")", "expected ')' after if condition");
  }
  if (!state.matchKeyword("goto")) {
    state.error(state.current(), "E2019", "expected 'goto' after if condition");
    return undefined;
  }
  const target = parseLabelRef(state, "expected label after 'if ... goto'");
  if (!target) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "IfGotoStmt",
    span: span(state.fileId, start, target.span.end),
    condition,
    target,
  };
}

function parseLabelStmt(state: ParserState): LabelStmt | undefined {
  state.matchSymbol("@");
  const label = state.parseIdent("expected label");
  if (!label) {
    return undefined;
  }
  state.consumeSymbol(":", "expected ':' after label");
  return {
    id: state.id(),
    kind: "LabelStmt",
    span: label.span,
    label,
  };
}

function parseMultiAssignStmt(state: ParserState): MultiAssignStmt | undefined {
  const pattern = parseTuplePattern(state);
  if (!pattern) {
    return undefined;
  }
  if (!state.matchSymbol("=")) {
    state.error(state.current(), "E2018", "expected '=' after tuple assignment target");
    return undefined;
  }
  const value = parseExpr(state);
  if (!value) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "MultiAssignStmt",
    span: span(state.fileId, pattern.span.start, value.span.end),
    pattern,
    value,
  };
}

function parseAssignOrCallStmt(state: ParserState): Stmt | undefined {
  const start = state.current()?.span.start ?? state.previous().span.end;
  const lhsToken = state.current();
  if (lhsToken?.kind === "Ident" && state.checkSymbol("=", 1) && REG_OR_ALIAS_RE.test(lhsToken.text)) {
    state.index += 1;
    state.index += 1;
    const value = parseExpr(state);
    if (!value) {
      return undefined;
    }
    const node: AssignStmt = {
      id: state.id(),
      kind: "AssignStmt",
      span: span(state.fileId, start, value.span.end),
      target: {
        id: state.id(),
        kind: "RegRefExpr",
        span: lhsToken.span,
        name: lhsToken.text,
      },
      value,
    };
    return node;
  }

  const expr = parseExpr(state);
  if (!expr) {
    return undefined;
  }
  if (expr.kind === "CallExpr") {
    const node: CallStmt = {
      id: state.id(),
      kind: "CallStmt",
      span: expr.span,
      call: expr,
    };
    return node;
  }
  state.error(state.current() ?? state.previous(), "E2017", "expected assignment or call statement");
  return undefined;
}

function parseLabelRef(state: ParserState, message: string): Ident | undefined {
  const withParens = state.matchSymbol("(");
  state.matchSymbol("@");
  const label = state.parseIdent(message);
  if (withParens) {
    state.consumeSymbol(")", "expected ')' after label reference");
  }
  return label;
}

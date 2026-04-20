import type {
  AssignStmt,
  CallStmt,
  Expr,
  FnBodyAliasDecl,
  GotoStmt,
  Ident,
  IfStmt,
  IfGotoStmt,
  LabelStmt,
  MultiAssignStmt,
  RegRefExpr,
  ReturnStmt,
  SaveStmt,
  SlotBinding,
  Stmt,
} from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parseExpr } from "./expr.js";
import { parseSlotBinding, parseSlotBindingList, parseTuplePattern } from "./shared.js";

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
    return parseIfStmtOrIfGoto(state, tk.span.start);
  }
  if (state.matchKeyword("save")) {
    return parseSaveStmt(state, tk.span.start);
  }
  if (
    (tk.kind === "Ident" && state.checkSymbol(":", 1) && !state.checkSymbol(":", 2)) ||
    (state.checkSymbol("@") && state.peek(1)?.kind === "Ident")
  ) {
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
  const last = values.length > 0 ? values[values.length - 1] : undefined;
  const end = last ? last.span.end : state.previous().span.end;
  return {
    id: state.id(),
    kind: "ReturnStmt",
    span: span(state.fileId, start, end),
    values,
  };
}

function parseGotoStmt(state: ParserState, start: number): GotoStmt | undefined {
  const ref = parseLabelRef(state, "expected label after 'goto'");
  if (!ref) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "GotoStmt",
    span: span(state.fileId, start, ref.end),
    label: ref.label,
    args: ref.args,
  };
}

function parseIfStmtOrIfGoto(state: ParserState, start: number): IfStmt | IfGotoStmt | undefined {
  const wrapped = state.matchSymbol("(");
  const condition = parseExpr(state);
  if (!condition) {
    return undefined;
  }
  if (wrapped) {
    state.consumeSymbol(")", "expected ')' after if condition");
  }

  if (state.checkSymbol("{")) {
    return parseIfStmt(state, start, condition);
  }

  if (!state.matchKeyword("goto")) {
    state.error(state.current(), "E2019", "expected 'goto' after if condition");
    return undefined;
  }
  const ref = parseLabelRef(state, "expected label after 'if ... goto'");
  if (!ref) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "IfGotoStmt",
    span: span(state.fileId, start, ref.end),
    condition,
    target: ref.label,
    args: ref.args,
  };
}

function parseLabelStmt(state: ParserState): LabelStmt | undefined {
  state.matchSymbol("@");
  const label = state.parseIdent("expected label");
  if (!label) {
    return undefined;
  }
  let params: SlotBinding[] = [];
  if (state.checkSymbol("(")) {
    params = parseSlotBindingList(state, "expected '(' after label name") ?? [];
  }
  state.consumeSymbol(":", "expected ':' after label");
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "LabelStmt",
    span: span(state.fileId, label.span.start, end),
    label,
    params,
  };
}

function parseSaveStmt(state: ParserState, start: number): SaveStmt | undefined {
  const slots = parseRegRefList(state, "expected register list after 'save'");
  if (!slots) {
    return undefined;
  }
  const body = parseStmtBlock(state, "expected '{' after save register list");
  if (!body) {
    return undefined;
  }
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "SaveStmt",
    span: span(state.fileId, start, end),
    slots,
    body,
  };
}

function parseIfStmt(state: ParserState, start: number, condition: Expr): IfStmt | undefined {
  const thenBody = parseStmtBlock(state, "expected '{' to start if block");
  if (!thenBody) {
    return undefined;
  }
  let elseBody: Stmt[] = [];
  if (state.matchKeyword("else")) {
    const parsedElse = parseStmtBlock(state, "expected '{' to start else block");
    if (!parsedElse) {
      return undefined;
    }
    elseBody = parsedElse;
  }
  const end = state.previous().span.end;
  return {
    id: state.id(),
    kind: "IfStmt",
    span: span(state.fileId, start, end),
    condition,
    thenBody,
    elseBody,
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

function parseLabelRef(
  state: ParserState,
  message: string,
): { label: Ident; args: RegRefExpr[]; end: number } | undefined {
  const withParens = state.matchSymbol("(");
  state.matchSymbol("@");
  const label = state.parseIdent(message);
  if (!label) {
    return undefined;
  }
  let args: RegRefExpr[] = [];
  if (state.checkSymbol("(")) {
    args = parseRegRefList(state, "expected label argument list") ?? [];
  }
  if (withParens) {
    state.consumeSymbol(")", "expected ')' after label reference");
  }
  return { label, args, end: state.previous().span.end };
}

function parseStmtBlock(state: ParserState, message: string): Stmt[] | undefined {
  if (!state.consumeSymbol("{", message)) {
    return undefined;
  }
  const body: Stmt[] = [];
  while (!state.at("Eof")) {
    if (state.matchNewline()) {
      continue;
    }
    if (state.matchSymbol("}")) {
      return body;
    }
    const stmt = parseStmt(state);
    if (!stmt) {
      break;
    }
    body.push(stmt);
  }
  state.error(state.current(), "E2032", "expected '}' to close block");
  return body;
}

function parseRegRefList(state: ParserState, message: string): RegRefExpr[] | undefined {
  if (!state.consumeSymbol("(", message)) {
    return undefined;
  }
  const args: RegRefExpr[] = [];
  while (!state.at("Eof")) {
    if (state.matchSymbol(")")) {
      break;
    }
    const tk = state.consume((t) => t.kind === "Ident", "expected register name");
    if (!tk || !/^r\d+$|^f\d+$/.test(tk.text)) {
      state.error(tk, "E2011", "expected register slot like r0/f0");
      return undefined;
    }
    args.push({
      id: state.id(),
      kind: "RegRefExpr",
      span: tk.span,
      name: tk.text,
    });
    if (state.matchSymbol(")")) {
      break;
    }
    if (!state.matchSymbol(",")) {
      state.error(state.current(), "E2012", "expected ',' or ')' in register list");
      return undefined;
    }
  }
  return args;
}

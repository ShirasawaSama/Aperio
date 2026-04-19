import type { BinaryExpr, Expr, FileUnit, FnDecl, LiteralExpr, ReturnStmt, Stmt } from "@aperio/ast";

// Minimal native-strict x86_64 (Windows ABI flavored) asm emitter.
// v1 scope: enough for hello-world style functions and simple arithmetic.
export function emitNativeWin64FromAst(file: FileUnit): string {
  const lines: string[] = [".intel_syntax noprefix", ".text"];
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    lines.push(...emitFunction(item));
  }
  return `${lines.join("\n")}\n`;
}

function emitFunction(fn: FnDecl): string[] {
  const out: string[] = [];
  const name = sanitizeSymbol(fn.name.text);
  const endLabel = `.L_${name}_ret`;
  out.push(`.globl ${name}`);
  out.push(`${name}:`);
  out.push("  push rbp");
  out.push("  mov rbp, rsp");
  out.push("  sub rsp, 32");
  for (const stmt of fn.body) {
    emitStmt(stmt, out, endLabel);
  }
  out.push(`${endLabel}:`);
  out.push("  add rsp, 32");
  out.push("  pop rbp");
  out.push("  ret");
  out.push("");
  return out;
}

function emitStmt(stmt: Stmt, out: string[], endLabel: string): void {
  switch (stmt.kind) {
    case "LabelStmt":
      out.push(`.${sanitizeSymbol(stmt.label.text)}:`);
      return;
    case "GotoStmt":
      out.push(`  jmp .${sanitizeSymbol(stmt.label.text)}`);
      return;
    case "IfGotoStmt":
      emitIfGoto(stmt.condition, stmt.target.text, out);
      return;
    case "AssignStmt":
      emitAssign(stmt.target.name, stmt.value, out);
      return;
    case "ReturnStmt":
      emitReturn(stmt, out, endLabel);
      return;
    default:
      // Keep unsupported statements as comments for debug visibility.
      out.push(`  # unsupported stmt: ${stmt.kind}`);
      return;
  }
}

function emitIfGoto(condition: Expr, target: string, out: string[]): void {
  if (condition.kind === "BinaryExpr") {
    const lhs = exprToOperand(condition.left);
    const rhs = exprToOperand(condition.right);
    if (lhs && rhs) {
      out.push(`  cmp ${lhs}, ${rhs}`);
      out.push(`  ${jumpFor(condition)} .${sanitizeSymbol(target)}`);
      return;
    }
  }
  const value = exprToOperand(condition);
  if (value) {
    out.push(`  cmp ${value}, 0`);
    out.push(`  jne .${sanitizeSymbol(target)}`);
  }
}

function emitAssign(target: string, value: Expr, out: string[]): void {
  const dst = regToAsm(target);
  if (!dst) {
    out.push(`  # unsupported assign target: ${target}`);
    return;
  }
  if (value.kind === "BinaryExpr") {
    if (value.left.kind === "RegRefExpr" && value.left.name === target) {
      const rhs = exprToOperand(value.right);
      if (rhs) {
        const op = binaryOpToAsm(value.op);
        if (op) {
          out.push(`  ${op} ${dst}, ${rhs}`);
          return;
        }
      }
    }
  }
  const src = exprToOperand(value);
  if (!src) {
    out.push(`  # unsupported assign value: ${value.kind}`);
    return;
  }
  out.push(`  mov ${dst}, ${src}`);
}

function emitReturn(stmt: ReturnStmt, out: string[], endLabel: string): void {
  const first = stmt.values[0];
  if (first) {
    const src = exprToOperand(first);
    if (src && src !== "rax") {
      out.push(`  mov rax, ${src}`);
    }
  }
  out.push(`  jmp ${endLabel}`);
}

function exprToOperand(expr: Expr): string | undefined {
  if (expr.kind === "LiteralExpr") {
    return literalToAsm(expr);
  }
  if (expr.kind === "RegRefExpr") {
    return regToAsm(expr.name);
  }
  if (expr.kind === "IdentExpr") {
    return regToAsm(expr.name.text) ?? sanitizeSymbol(expr.name.text);
  }
  return undefined;
}

function literalToAsm(expr: LiteralExpr): string | undefined {
  if (expr.literalKind === "int") {
    const raw = expr.value.replaceAll("_", "");
    if (/^-?\d+$/.test(raw)) {
      return raw;
    }
  }
  if (expr.literalKind === "bool") {
    return expr.value === "true" ? "1" : "0";
  }
  return undefined;
}

function regToAsm(name: string): string | undefined {
  const m = /^r(\d+)$/.exec(name);
  if (!m) {
    return undefined;
  }
  const i = Number.parseInt(m[1] ?? "", 10);
  const map: string[] = [
    "rax",
    "rcx",
    "rdx",
    "rbx",
    "rsp",
    "rbp",
    "rsi",
    "rdi",
    "r8",
    "r9",
    "r10",
    "r11",
    "r12",
    "r13",
    "r14",
    "r15",
  ];
  return map[i];
}

function jumpFor(expr: BinaryExpr): string {
  switch (expr.op) {
    case "==":
      return "je";
    case "!=":
      return "jne";
    case "<":
      return "jl";
    case "<=":
      return "jle";
    case ">":
      return "jg";
    case ">=":
      return "jge";
    default:
      return "jne";
  }
}

function binaryOpToAsm(op: string): string | undefined {
  switch (op) {
    case "+":
      return "add";
    case "-":
      return "sub";
    case "&":
      return "and";
    case "|":
      return "or";
    case "^":
      return "xor";
    default:
      return undefined;
  }
}

function sanitizeSymbol(name: string): string {
  return name.replaceAll("::", "_");
}

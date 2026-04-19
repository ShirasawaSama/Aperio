import type {
  BinaryExpr,
  CallArg,
  CallStmt,
  Expr,
  FileUnit,
  FnDecl,
  LiteralExpr,
  ReturnStmt,
  Stmt,
} from "@aperio/ast";

// Minimal native-strict x86_64 (Windows ABI flavored) asm emitter.
// v1 scope: enough for hello-world style functions and simple arithmetic.
export function emitNativeWin64FromAst(file: FileUnit): string {
  const lines: string[] = [".intel_syntax noprefix", ".extern ExitProcess", ".extern GetStdHandle", ".extern WriteFile"];
  const dataSection = emitReadonlyData(file);
  if (dataSection.length > 0) {
    lines.push(".section .rdata");
    lines.push(...dataSection);
  }
  lines.push(".text");
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    lines.push(...emitFunction(item));
  }
  return `${lines.join("\n")}\n`;
}

export function emitNativeWin64MasmFromAst(file: FileUnit): string {
  const lines: string[] = [
    "option casemap:none",
    "EXTERN ExitProcess:PROC",
    "EXTERN GetStdHandle:PROC",
    "EXTERN WriteFile:PROC",
  ];
  const dataSection = emitReadonlyDataMasm(file);
  if (dataSection.length > 0) {
    lines.push(".const");
    lines.push(...dataSection);
  }
  lines.push(".code");
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    lines.push(...emitFunctionMasm(item));
  }
  lines.push("END");
  return `${lines.join("\r\n")}\r\n`;
}

function emitFunction(fn: FnDecl): string[] {
  const out: string[] = [];
  const name = sanitizeSymbol(fn.name.text);
  const endLabel = `.L_${name}_ret`;
  out.push(`.globl ${name}`);
  out.push(`${name}:`);
  out.push("  push rbp");
  out.push("  mov rbp, rsp");
  out.push("  sub rsp, 48");
  for (const stmt of fn.body) {
    emitStmt(stmt, out, endLabel);
  }
  out.push(`${endLabel}:`);
  out.push("  add rsp, 48");
  out.push("  pop rbp");
  out.push("  ret");
  out.push("");
  return out;
}

function emitFunctionMasm(fn: FnDecl): string[] {
  const out: string[] = [];
  const name = sanitizeSymbol(fn.name.text);
  const endLabel = `L_${name}_ret`;
  out.push(`${name} PROC`);
  out.push("  push rbp");
  out.push("  mov rbp, rsp");
  out.push("  sub rsp, 48");
  for (const stmt of fn.body) {
    emitStmtMasm(stmt, out, endLabel);
  }
  out.push(`${endLabel}:`);
  out.push("  add rsp, 48");
  out.push("  pop rbp");
  out.push("  ret");
  out.push(`${name} ENDP`);
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
    case "CallStmt":
      emitCall(stmt, out);
      return;
    default:
      // Keep unsupported statements as comments for debug visibility.
      out.push(`  # unsupported stmt: ${stmt.kind}`);
      return;
  }
}

function emitStmtMasm(stmt: Stmt, out: string[], endLabel: string): void {
  switch (stmt.kind) {
    case "LabelStmt":
      out.push(`${sanitizeLabel(stmt.label.text)}:`);
      return;
    case "GotoStmt":
      out.push(`  jmp ${sanitizeLabel(stmt.label.text)}`);
      return;
    case "IfGotoStmt":
      emitIfGotoMasm(stmt.condition, stmt.target.text, out);
      return;
    case "AssignStmt":
      emitAssignMasm(stmt.target.name, stmt.value, out);
      return;
    case "ReturnStmt":
      emitReturnMasm(stmt, out, endLabel);
      return;
    case "CallStmt":
      emitCallMasm(stmt, out);
      return;
    default:
      out.push(`  ; unsupported stmt: ${stmt.kind}`);
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

function emitIfGotoMasm(condition: Expr, target: string, out: string[]): void {
  if (condition.kind === "BinaryExpr") {
    const lhs = exprToOperandMasm(condition.left);
    const rhs = exprToOperandMasm(condition.right);
    if (lhs && rhs) {
      out.push(`  cmp ${lhs}, ${rhs}`);
      out.push(`  ${jumpFor(condition)} ${sanitizeLabel(target)}`);
      return;
    }
  }
  const value = exprToOperandMasm(condition);
  if (value) {
    out.push(`  cmp ${value}, 0`);
    out.push(`  jne ${sanitizeLabel(target)}`);
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

function emitAssignMasm(target: string, value: Expr, out: string[]): void {
  const dst = regToAsm(target);
  if (!dst) {
    out.push(`  ; unsupported assign target: ${target}`);
    return;
  }
  if (value.kind === "BinaryExpr") {
    if (value.left.kind === "RegRefExpr" && value.left.name === target) {
      const rhs = exprToOperandMasm(value.right);
      if (rhs) {
        const op = binaryOpToAsm(value.op);
        if (op) {
          out.push(`  ${op} ${dst}, ${rhs}`);
          return;
        }
      }
    }
  }
  const src = exprToOperandMasm(value);
  if (!src) {
    out.push(`  ; unsupported assign value: ${value.kind}`);
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

function emitReturnMasm(stmt: ReturnStmt, out: string[], endLabel: string): void {
  const first = stmt.values[0];
  if (first) {
    const src = exprToOperandMasm(first);
    if (src && src !== "rax") {
      out.push(`  mov rax, ${src}`);
    }
  }
  out.push(`  jmp ${endLabel}`);
}

function emitCall(stmt: CallStmt, out: string[]): void {
  if (stmt.call.callee.kind === "IdentExpr" && stmt.call.callee.name.text === "os::exit") {
    const codeArg = stmt.call.args.find((arg) => arg.name?.text === "code") ?? stmt.call.args[0];
    if (!codeArg) {
      out.push("  # unsupported os::exit call: missing code argument");
      return;
    }
    const code = exprToOperand(codeArg.value);
    if (!code) {
      out.push("  # unsupported os::exit call: non-literal/non-register argument");
      return;
    }
    out.push(`  mov ecx, ${code}`);
    out.push("  call ExitProcess");
    return;
  }
  if (stmt.call.callee.kind === "IdentExpr" && stmt.call.callee.name.text === "os::write_stdout") {
    emitWriteStdout(stmt.call.args, out);
    return;
  }
  out.push(`  # unsupported call: ${renderCallName(stmt.call.callee)}`);
}

function emitCallMasm(stmt: CallStmt, out: string[]): void {
  if (stmt.call.callee.kind === "IdentExpr" && stmt.call.callee.name.text === "os::exit") {
    const codeArg = stmt.call.args.find((arg) => arg.name?.text === "code") ?? stmt.call.args[0];
    if (!codeArg) {
      out.push("  ; unsupported os::exit call: missing code argument");
      return;
    }
    const code = exprToOperandMasm(codeArg.value);
    if (!code) {
      out.push("  ; unsupported os::exit call: non-literal/non-register argument");
      return;
    }
    out.push(`  mov ecx, ${code}`);
    out.push("  call ExitProcess");
    return;
  }
  if (stmt.call.callee.kind === "IdentExpr" && stmt.call.callee.name.text === "os::write_stdout") {
    emitWriteStdoutMasm(stmt.call.args, out);
    return;
  }
  out.push(`  ; unsupported call: ${renderCallName(stmt.call.callee)}`);
}

function emitWriteStdout(args: CallArg[], out: string[]): void {
  const ptrArg = args.find((arg) => arg.name?.text === "ptr") ?? args[0];
  const lenArg = args.find((arg) => arg.name?.text === "len") ?? args[1];
  if (!ptrArg || !lenArg) {
    out.push("  # unsupported os::write_stdout call: expected ptr and len");
    return;
  }
  const len = exprToOperand(lenArg.value);
  if (!len) {
    out.push("  # unsupported os::write_stdout call: len must be register/literal");
    return;
  }
  out.push("  mov ecx, -11");
  out.push("  call GetStdHandle");
  out.push("  mov rcx, rax");
  emitPointerLoadTo("rdx", ptrArg.value, out);
  out.push(`  mov r8d, ${len}`);
  out.push("  xor r9d, r9d");
  out.push("  mov qword ptr [rsp+32], 0");
  out.push("  call WriteFile");
}

function emitWriteStdoutMasm(args: CallArg[], out: string[]): void {
  const ptrArg = args.find((arg) => arg.name?.text === "ptr") ?? args[0];
  const lenArg = args.find((arg) => arg.name?.text === "len") ?? args[1];
  if (!ptrArg || !lenArg) {
    out.push("  ; unsupported os::write_stdout call: expected ptr and len");
    return;
  }
  const len = exprToOperandMasm(lenArg.value);
  if (!len) {
    out.push("  ; unsupported os::write_stdout call: len must be register/literal");
    return;
  }
  out.push("  mov ecx, -11");
  out.push("  call GetStdHandle");
  out.push("  mov rcx, rax");
  emitPointerLoadToMasm("rdx", ptrArg.value, out);
  out.push(`  mov r8d, ${len}`);
  out.push("  xor r9d, r9d");
  out.push("  mov qword ptr [rsp+32], 0");
  out.push("  call WriteFile");
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

function exprToOperandMasm(expr: Expr): string | undefined {
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

function renderCallName(expr: Expr): string {
  if (expr.kind === "IdentExpr") {
    return expr.name.text;
  }
  if (expr.kind === "RegRefExpr") {
    return expr.name;
  }
  return expr.kind;
}

function emitReadonlyData(file: FileUnit): string[] {
  const out: string[] = [];
  for (const item of file.items) {
    if (item.kind !== "ValDecl") {
      continue;
    }
    const value = item.init;
    if (!value || value.kind !== "LiteralExpr" || value.literalKind !== "string") {
      continue;
    }
    const symbol = sanitizeSymbol(item.name.text);
    out.push(`${symbol}:`);
    out.push(`  .asciz ${value.value}`);
  }
  return out;
}

function emitReadonlyDataMasm(file: FileUnit): string[] {
  const out: string[] = [];
  for (const item of file.items) {
    if (item.kind !== "ValDecl") {
      continue;
    }
    const value = item.init;
    if (!value || value.kind !== "LiteralExpr" || value.literalKind !== "string") {
      continue;
    }
    const symbol = sanitizeSymbol(item.name.text);
    const bytes = parseCStringBytes(value.value);
    out.push(`${symbol} DB ${bytes.join(", ")}`);
  }
  return out;
}

function emitPointerLoadTo(targetReg: string, value: Expr, out: string[]): void {
  if (value.kind === "IdentExpr") {
    out.push(`  lea ${targetReg}, [rip + ${sanitizeSymbol(value.name.text)}]`);
    return;
  }
  const src = exprToOperand(value);
  if (src) {
    out.push(`  mov ${targetReg}, ${src}`);
    return;
  }
  out.push(`  # unsupported pointer expression: ${value.kind}`);
}

function emitPointerLoadToMasm(targetReg: string, value: Expr, out: string[]): void {
  if (value.kind === "IdentExpr") {
    out.push(`  lea ${targetReg}, ${sanitizeSymbol(value.name.text)}`);
    return;
  }
  const src = exprToOperandMasm(value);
  if (src) {
    out.push(`  mov ${targetReg}, ${src}`);
    return;
  }
  out.push(`  ; unsupported pointer expression: ${value.kind}`);
}

function parseCStringBytes(rawToken: string): number[] {
  const raw = stripQuotes(rawToken);
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === "n") {
        bytes.push(10);
        i += 1;
        continue;
      }
      if (next === "r") {
        bytes.push(13);
        i += 1;
        continue;
      }
      if (next === "t") {
        bytes.push(9);
        i += 1;
        continue;
      }
      if (next === "0") {
        bytes.push(0);
        i += 1;
        continue;
      }
      if (next === "\\" || next === "\"") {
        bytes.push(next.charCodeAt(0));
        i += 1;
        continue;
      }
    }
    if (ch) {
      bytes.push(ch.charCodeAt(0));
    }
  }
  bytes.push(0);
  return bytes;
}

function stripQuotes(text: string): string {
  if (text.startsWith("\"") && text.endsWith("\"")) {
    return text.slice(1, -1);
  }
  return text;
}

function sanitizeLabel(name: string): string {
  return sanitizeSymbol(name);
}

import type {
  BinaryExpr,
  CallArg,
  CallStmt,
  ExternFnDecl,
  Expr,
  FileUnit,
  FnDecl,
  LiteralExpr,
  ReturnStmt,
  SlotBinding,
  Stmt,
  TypeExpr,
} from "@aperio/ast";

interface Win64EmitCtx {
  externDeclByName: Map<string, ExternFnDecl>;
  /** `import "…" as foo` → `foo` (used to recognize `foo::bar` calls). */
  importAliases: Set<string>;
}

// Minimal native-strict x86_64 (Windows ABI flavored) asm emitter.
// v1 scope: enough for hello-world style functions and simple arithmetic.
export function emitNativeWin64FromAst(file: FileUnit): string {
  const ctx = buildWin64EmitCtx(file);
  const externNames = collectExternSymbolNames(file);
  const lines: string[] = [
    ".intel_syntax noprefix",
    ...externNames.map((sym) => `.extern ${sanitizeSymbol(sym)}`),
  ];
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
    lines.push(...emitFunction(item, ctx));
  }
  return `${lines.join("\n")}\n`;
}

export function emitNativeWin64MasmFromAst(file: FileUnit): string {
  const ctx = buildWin64EmitCtx(file);
  const externNames = collectExternSymbolNames(file);
  const lines: string[] = [
    "option casemap:none",
    ...externNames.map((sym) => `EXTERN ${sanitizeSymbol(sym)}:PROC`),
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
    lines.push(...emitFunctionMasm(item, ctx));
  }
  lines.push("END");
  return `${lines.join("\r\n")}\r\n`;
}

function buildWin64EmitCtx(file: FileUnit): Win64EmitCtx {
  const externDeclByName = new Map<string, ExternFnDecl>();
  for (const item of file.items) {
    if (item.kind !== "ExternFnDecl") {
      continue;
    }
    externDeclByName.set(item.name.text, item);
  }
  return { externDeclByName, importAliases: collectImportAliases(file) };
}

function collectImportAliases(file: FileUnit): Set<string> {
  const aliases = new Set<string>();
  for (const item of file.items) {
    if (item.kind === "ImportDecl") {
      aliases.add(item.alias.text);
    }
  }
  return aliases;
}

function externLinkSymbol(decl: ExternFnDecl): string {
  return readNameAttribute(decl) ?? decl.name.text;
}

function readNameAttribute(decl: ExternFnDecl): string | undefined {
  for (const attr of decl.attrs) {
    if (attr.name.text !== "name" || attr.args.length === 0) {
      continue;
    }
    const arg0 = attr.args[0];
    if (arg0?.kind === "LiteralExpr" && arg0.literalKind === "string") {
      return stripQuotes(arg0.value);
    }
  }
  return undefined;
}

function collectExternSymbolNames(file: FileUnit): string[] {
  const set = new Set<string>();
  for (const item of file.items) {
    if (item.kind === "ExternFnDecl") {
      set.add(externLinkSymbol(item));
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Qualified calls must use a known import alias; unqualified names pass through. */
function calleeShortNameForExtern(callee: Expr, importAliases: Set<string>): string | undefined {
  if (callee.kind !== "IdentExpr") {
    return undefined;
  }
  const full = callee.name.text;
  const idx = full.lastIndexOf("::");
  if (idx < 0) {
    return full;
  }
  const alias = full.slice(0, idx);
  if (!importAliases.has(alias)) {
    return undefined;
  }
  return full.slice(idx + 2);
}

function emitFunction(fn: FnDecl, ctx: Win64EmitCtx): string[] {
  const out: string[] = [];
  const name = sanitizeSymbol(fn.name.text);
  const endLabel = `.L_${name}_ret`;
  out.push(`.globl ${name}`);
  out.push(`${name}:`);
  out.push("  push rbp");
  out.push("  mov rbp, rsp");
  out.push("  sub rsp, 48");
  for (const stmt of fn.body) {
    emitStmt(stmt, out, endLabel, ctx);
  }
  out.push(`${endLabel}:`);
  out.push("  add rsp, 48");
  out.push("  pop rbp");
  out.push("  ret");
  out.push("");
  return out;
}

function emitFunctionMasm(fn: FnDecl, ctx: Win64EmitCtx): string[] {
  const out: string[] = [];
  const name = sanitizeSymbol(fn.name.text);
  const endLabel = `L_${name}_ret`;
  out.push(`${name} PROC`);
  out.push("  push rbp");
  out.push("  mov rbp, rsp");
  out.push("  sub rsp, 48");
  for (const stmt of fn.body) {
    emitStmtMasm(stmt, out, endLabel, ctx);
  }
  out.push(`${endLabel}:`);
  out.push("  add rsp, 48");
  out.push("  pop rbp");
  out.push("  ret");
  out.push(`${name} ENDP`);
  out.push("");
  return out;
}

function emitStmt(stmt: Stmt, out: string[], endLabel: string, ctx: Win64EmitCtx): void {
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
      emitCall(stmt, out, ctx);
      return;
    default:
      // Keep unsupported statements as comments for debug visibility.
      out.push(`  # unsupported stmt: ${stmt.kind}`);
      return;
  }
}

function emitStmtMasm(stmt: Stmt, out: string[], endLabel: string, ctx: Win64EmitCtx): void {
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
      emitCallMasm(stmt, out, ctx);
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

function emitCall(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): void {
  if (tryEmitExternCall(stmt, out, ctx)) {
    return;
  }
  if (isImportQualifiedCall(stmt, "__macro_write_stdout", ctx)) {
    emitWriteStdout(stmt.call.args, out);
    return;
  }
  out.push(`  # unsupported call: ${renderCallName(stmt.call.callee)}`);
}

function emitCallMasm(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): void {
  if (tryEmitExternCallMasm(stmt, out, ctx)) {
    return;
  }
  if (isImportQualifiedCall(stmt, "__macro_write_stdout", ctx)) {
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

type ArgKind = "ptr" | "int32" | "int64";

function externArgKind(t: TypeExpr | undefined): ArgKind {
  if (!t) {
    return "int64";
  }
  if (t.typeKind === "ptr") {
    return "ptr";
  }
  if (t.typeKind === "named") {
    if (t.name === "u32" || t.name === "i32") {
      return "int32";
    }
  }
  return "int64";
}

function dwordRegFor(reg64: string): string {
  switch (reg64) {
    case "rcx":
      return "ecx";
    case "rdx":
      return "edx";
    case "r8":
      return "r8d";
    case "r9":
      return "r9d";
    default:
      return reg64;
  }
}

function resolveExternCallArg(args: CallArg[], param: SlotBinding, index: number): Expr | undefined {
  const named = args.find((a) => a.name?.text === param.alias.text);
  if (named) {
    return named.value;
  }
  return args[index]?.value;
}

function emitExternArgIntoRegGas(param: SlotBinding, expr: Expr, reg64: string, out: string[]): boolean {
  const kind = externArgKind(param.type);
  if (kind === "ptr") {
    emitPointerLoadTo(reg64, expr, out);
    return true;
  }
  if (kind === "int32") {
    const op = exprToOperand(expr);
    if (!op) {
      return false;
    }
    out.push(`  mov ${dwordRegFor(reg64)}, ${op}`);
    return true;
  }
  if (expr.kind === "IdentExpr" && !regToAsm(expr.name.text)) {
    emitPointerLoadTo(reg64, expr, out);
    return true;
  }
  const op = exprToOperand(expr);
  if (!op) {
    return false;
  }
  out.push(`  mov ${reg64}, ${op}`);
  return true;
}

function emitExternArgIntoRegMasm(param: SlotBinding, expr: Expr, reg64: string, out: string[]): boolean {
  const kind = externArgKind(param.type);
  if (kind === "ptr") {
    emitPointerLoadToMasm(reg64, expr, out);
    return true;
  }
  if (kind === "int32") {
    const op = exprToOperandMasm(expr);
    if (!op) {
      return false;
    }
    out.push(`  mov ${dwordRegFor(reg64)}, ${op}`);
    return true;
  }
  if (expr.kind === "IdentExpr" && !regToAsm(expr.name.text)) {
    emitPointerLoadToMasm(reg64, expr, out);
    return true;
  }
  const op = exprToOperandMasm(expr);
  if (!op) {
    return false;
  }
  out.push(`  mov ${reg64}, ${op}`);
  return true;
}

function emitExternArgIntoStackGas(param: SlotBinding, expr: Expr, rspOffset: number, out: string[]): boolean {
  const kind = externArgKind(param.type);
  const slot = `qword ptr [rsp+${rspOffset}]`;
  const slot32 = `dword ptr [rsp+${rspOffset}]`;
  if (kind === "ptr") {
    emitPointerLoadTo("rax", expr, out);
    out.push(`  mov ${slot}, rax`);
    return true;
  }
  if (kind === "int32") {
    const op = exprToOperand(expr);
    if (!op) {
      return false;
    }
    out.push(`  mov ${slot32}, ${op}`);
    return true;
  }
  if (expr.kind === "IdentExpr" && !regToAsm(expr.name.text)) {
    emitPointerLoadTo("rax", expr, out);
    out.push(`  mov ${slot}, rax`);
    return true;
  }
  const op = exprToOperand(expr);
  if (!op) {
    return false;
  }
  out.push(`  mov ${slot}, ${op}`);
  return true;
}

function emitExternArgIntoStackMasm(param: SlotBinding, expr: Expr, rspOffset: number, out: string[]): boolean {
  const kind = externArgKind(param.type);
  if (kind === "ptr") {
    emitPointerLoadToMasm("rax", expr, out);
    out.push(`  mov QWORD PTR [rsp+${rspOffset}], rax`);
    return true;
  }
  if (kind === "int32") {
    const op = exprToOperandMasm(expr);
    if (!op) {
      return false;
    }
    out.push(`  mov DWORD PTR [rsp+${rspOffset}], ${op}`);
    return true;
  }
  if (expr.kind === "IdentExpr" && !regToAsm(expr.name.text)) {
    emitPointerLoadToMasm("rax", expr, out);
    out.push(`  mov QWORD PTR [rsp+${rspOffset}], rax`);
    return true;
  }
  const op = exprToOperandMasm(expr);
  if (!op) {
    return false;
  }
  out.push(`  mov QWORD PTR [rsp+${rspOffset}], ${op}`);
  return true;
}

function emitExternDeclCallGas(decl: ExternFnDecl, link: string, args: CallArg[], out: string[]): void {
  const regs64 = ["rcx", "rdx", "r8", "r9"] as const;
  for (let i = 0; i < decl.params.length; i += 1) {
    const param = decl.params[i];
    if (!param) {
      out.push(`  # unsupported extern '${decl.name.text}': missing parameter metadata`);
      return;
    }
    const expr = resolveExternCallArg(args, param, i);
    if (!expr) {
      out.push(`  # unsupported extern '${decl.name.text}': missing argument for '${param.alias.text}'`);
      return;
    }
    if (i < 4) {
      const reg = regs64[i];
      if (!reg) {
        return;
      }
      if (!emitExternArgIntoRegGas(param, expr, reg, out)) {
        out.push(`  # unsupported extern '${decl.name.text}': arg '${param.alias.text}'`);
        return;
      }
    } else if (i === 4) {
      if (!emitExternArgIntoStackGas(param, expr, 32, out)) {
        out.push(`  # unsupported extern '${decl.name.text}': stack arg '${param.alias.text}'`);
        return;
      }
    } else {
      out.push(`  # unsupported extern '${decl.name.text}': at most 5 arguments (Win64 home space)`);
      return;
    }
  }
  out.push(`  call ${sanitizeSymbol(link)}`);
}

function emitExternDeclCallMasm(decl: ExternFnDecl, link: string, args: CallArg[], out: string[]): void {
  const regs64 = ["rcx", "rdx", "r8", "r9"] as const;
  for (let i = 0; i < decl.params.length; i += 1) {
    const param = decl.params[i];
    if (!param) {
      out.push(`  ; unsupported extern '${decl.name.text}': missing parameter metadata`);
      return;
    }
    const expr = resolveExternCallArg(args, param, i);
    if (!expr) {
      out.push(`  ; unsupported extern '${decl.name.text}': missing argument for '${param.alias.text}'`);
      return;
    }
    if (i < 4) {
      const reg = regs64[i];
      if (!reg) {
        return;
      }
      if (!emitExternArgIntoRegMasm(param, expr, reg, out)) {
        out.push(`  ; unsupported extern '${decl.name.text}': arg '${param.alias.text}'`);
        return;
      }
    } else if (i === 4) {
      if (!emitExternArgIntoStackMasm(param, expr, 32, out)) {
        out.push(`  ; unsupported extern '${decl.name.text}': stack arg '${param.alias.text}'`);
        return;
      }
    } else {
      out.push(`  ; unsupported extern '${decl.name.text}': at most 5 arguments (Win64 home space)`);
      return;
    }
  }
  out.push(`  call ${sanitizeSymbol(link)}`);
}

function tryEmitExternCall(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): boolean {
  const short = calleeShortNameForExtern(stmt.call.callee, ctx.importAliases);
  if (!short) {
    return false;
  }
  const decl = ctx.externDeclByName.get(short);
  if (!decl) {
    return false;
  }
  if (decl.variadic) {
    out.push(`  # unsupported variadic extern '${short}'`);
    return true;
  }
  const link = externLinkSymbol(decl);
  emitExternDeclCallGas(decl, link, stmt.call.args, out);
  return true;
}

function tryEmitExternCallMasm(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): boolean {
  const short = calleeShortNameForExtern(stmt.call.callee, ctx.importAliases);
  if (!short) {
    return false;
  }
  const decl = ctx.externDeclByName.get(short);
  if (!decl) {
    return false;
  }
  if (decl.variadic) {
    out.push(`  ; unsupported variadic extern '${short}'`);
    return true;
  }
  const link = externLinkSymbol(decl);
  emitExternDeclCallMasm(decl, link, stmt.call.args, out);
  return true;
}

function isImportQualifiedCall(stmt: CallStmt, shortName: string, ctx: Win64EmitCtx): boolean {
  if (stmt.call.callee.kind !== "IdentExpr") {
    return false;
  }
  const full = stmt.call.callee.name.text;
  const idx = full.lastIndexOf("::");
  if (idx < 0) {
    return false;
  }
  const alias = full.slice(0, idx);
  const short = full.slice(idx + 2);
  return short === shortName && ctx.importAliases.has(alias);
}

function exprToOperand(expr: Expr): string | undefined {
  if (expr.kind === "LiteralExpr") {
    return literalToAsm(expr);
  }
  if (expr.kind === "UnaryExpr" && expr.op === "-" && expr.value.kind === "LiteralExpr") {
    const inner = literalToAsm(expr.value);
    if (inner && /^\d+$/.test(inner)) {
      return `-${inner}`;
    }
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
  if (expr.kind === "UnaryExpr" && expr.op === "-" && expr.value.kind === "LiteralExpr") {
    const inner = literalToAsm(expr.value);
    if (inner && /^\d+$/.test(inner)) {
      return `-${inner}`;
    }
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

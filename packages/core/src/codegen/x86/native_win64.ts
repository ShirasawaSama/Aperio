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
  Stmt,
} from "@aperio/ast";

interface Win64EmitCtx {
  /** Declared `extern fn` name (e.g. `write_file`) -> linker symbol (e.g. `WriteFile`). */
  externLinkByDeclName: Map<string, string>;
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
  const externLinkByDeclName = new Map<string, string>();
  for (const item of file.items) {
    if (item.kind !== "ExternFnDecl") {
      continue;
    }
    externLinkByDeclName.set(item.name.text, externLinkSymbol(item));
  }
  return { externLinkByDeclName };
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
  const set = new Set<string>(["ExitProcess", "GetStdHandle", "WriteFile"]);
  for (const item of file.items) {
    if (item.kind === "ExternFnDecl") {
      set.add(externLinkSymbol(item));
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function calleeShortName(callee: Expr): string | undefined {
  if (callee.kind !== "IdentExpr") {
    return undefined;
  }
  const full = callee.name.text;
  const idx = full.lastIndexOf("::");
  return idx >= 0 ? full.slice(idx + 2) : full;
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
  if (tryEmitExternMappedCall(stmt, out, ctx)) {
    return;
  }
  if (isOsCallName(stmt, "ExitProcess") || isOsCallName(stmt, "exit") || isOsCallName(stmt, "exit_process")) {
    const codeArg =
      findCallArg(stmt.call.args, ["uExitCode", "code"], 0);
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
  if (isOsCallName(stmt, "__macro_write_stdout")) {
    emitWriteStdout(stmt.call.args, out);
    return;
  }
  if (isOsCallName(stmt, "GetStdHandle") || isOsCallName(stmt, "get_std_handle")) {
    const handleArg = findCallArg(stmt.call.args, ["nStdHandle"], 0);
    if (!handleArg) {
      out.push("  # unsupported os::GetStdHandle call: missing nStdHandle");
      return;
    }
    const handle = exprToOperand(handleArg.value);
    if (!handle) {
      out.push("  # unsupported os::GetStdHandle call: nStdHandle must be register/literal");
      return;
    }
    out.push(`  mov ecx, ${handle}`);
    out.push("  call GetStdHandle");
    return;
  }
  if (isOsCallName(stmt, "WriteFile") || isOsCallName(stmt, "write_file")) {
    emitWriteFile(stmt.call.args, out);
    return;
  }
  out.push(`  # unsupported call: ${renderCallName(stmt.call.callee)}`);
}

function emitCallMasm(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): void {
  if (tryEmitExternMappedCallMasm(stmt, out, ctx)) {
    return;
  }
  if (isOsCallName(stmt, "ExitProcess") || isOsCallName(stmt, "exit") || isOsCallName(stmt, "exit_process")) {
    const codeArg =
      findCallArg(stmt.call.args, ["uExitCode", "code"], 0);
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
  if (isOsCallName(stmt, "__macro_write_stdout")) {
    emitWriteStdoutMasm(stmt.call.args, out);
    return;
  }
  if (isOsCallName(stmt, "GetStdHandle") || isOsCallName(stmt, "get_std_handle")) {
    const handleArg = findCallArg(stmt.call.args, ["nStdHandle"], 0);
    if (!handleArg) {
      out.push("  ; unsupported os::GetStdHandle call: missing nStdHandle");
      return;
    }
    const handle = exprToOperandMasm(handleArg.value);
    if (!handle) {
      out.push("  ; unsupported os::GetStdHandle call: nStdHandle must be register/literal");
      return;
    }
    out.push(`  mov ecx, ${handle}`);
    out.push("  call GetStdHandle");
    return;
  }
  if (isOsCallName(stmt, "WriteFile") || isOsCallName(stmt, "write_file")) {
    emitWriteFileMasm(stmt.call.args, out);
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

function emitWriteFile(args: CallArg[], out: string[]): void {
  const hFileArg = findCallArg(args, ["hFile"], 0);
  const bufferArg = findCallArg(args, ["lpBuffer"], 1);
  const bytesArg = findCallArg(args, ["nNumberOfBytesToWrite"], 2);
  const writtenArg = findCallArg(args, ["lpNumberOfBytesWritten"], 3);
  const overlappedArg = findCallArg(args, ["lpOverlapped"], 4);
  if (!hFileArg || !bufferArg || !bytesArg) {
    out.push("  # unsupported os::WriteFile call: expected hFile/lpBuffer/nNumberOfBytesToWrite");
    return;
  }
  const hFile = exprToOperand(hFileArg.value);
  const bytes = exprToOperand(bytesArg.value);
  if (!hFile || !bytes) {
    out.push("  # unsupported os::WriteFile call: handle/bytes must be register/literal");
    return;
  }
  out.push(`  mov rcx, ${hFile}`);
  emitPointerLoadTo("rdx", bufferArg.value, out);
  out.push(`  mov r8d, ${bytes}`);
  if (writtenArg) {
    emitPointerLoadTo("r9", writtenArg.value, out);
  } else {
    out.push("  xor r9d, r9d");
  }
  if (overlappedArg) {
    const overlapped = exprToOperand(overlappedArg.value);
    if (!overlapped) {
      out.push("  # unsupported os::WriteFile call: lpOverlapped must be register/literal");
      return;
    }
    out.push(`  mov qword ptr [rsp+32], ${overlapped}`);
  } else {
    out.push("  mov qword ptr [rsp+32], 0");
  }
  out.push("  call WriteFile");
}

function emitWriteFileMasm(args: CallArg[], out: string[]): void {
  const hFileArg = findCallArg(args, ["hFile"], 0);
  const bufferArg = findCallArg(args, ["lpBuffer"], 1);
  const bytesArg = findCallArg(args, ["nNumberOfBytesToWrite"], 2);
  const writtenArg = findCallArg(args, ["lpNumberOfBytesWritten"], 3);
  const overlappedArg = findCallArg(args, ["lpOverlapped"], 4);
  if (!hFileArg || !bufferArg || !bytesArg) {
    out.push("  ; unsupported os::WriteFile call: expected hFile/lpBuffer/nNumberOfBytesToWrite");
    return;
  }
  const hFile = exprToOperandMasm(hFileArg.value);
  const bytes = exprToOperandMasm(bytesArg.value);
  if (!hFile || !bytes) {
    out.push("  ; unsupported os::WriteFile call: handle/bytes must be register/literal");
    return;
  }
  out.push(`  mov rcx, ${hFile}`);
  emitPointerLoadToMasm("rdx", bufferArg.value, out);
  out.push(`  mov r8d, ${bytes}`);
  if (writtenArg) {
    emitPointerLoadToMasm("r9", writtenArg.value, out);
  } else {
    out.push("  xor r9d, r9d");
  }
  if (overlappedArg) {
    const overlapped = exprToOperandMasm(overlappedArg.value);
    if (!overlapped) {
      out.push("  ; unsupported os::WriteFile call: lpOverlapped must be register/literal");
      return;
    }
    out.push(`  mov qword ptr [rsp+32], ${overlapped}`);
  } else {
    out.push("  mov qword ptr [rsp+32], 0");
  }
  out.push("  call WriteFile");
}

function tryEmitExternMappedCall(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): boolean {
  const short = calleeShortName(stmt.call.callee);
  if (!short) {
    return false;
  }
  const link = ctx.externLinkByDeclName.get(short);
  if (!link) {
    return false;
  }
  switch (link) {
    case "ExitProcess": {
      const codeArg =
        findCallArg(stmt.call.args, ["uExitCode", "code"], 0);
      if (!codeArg) {
        out.push("  # unsupported extern ExitProcess call: missing code argument");
        return true;
      }
      const code = exprToOperand(codeArg.value);
      if (!code) {
        out.push("  # unsupported extern ExitProcess call: non-literal/non-register argument");
        return true;
      }
      out.push(`  mov ecx, ${code}`);
      out.push("  call ExitProcess");
      return true;
    }
    case "GetStdHandle": {
      const handleArg = findCallArg(stmt.call.args, ["nStdHandle"], 0);
      if (!handleArg) {
        out.push("  # unsupported extern GetStdHandle call: missing nStdHandle");
        return true;
      }
      const handle = exprToOperand(handleArg.value);
      if (!handle) {
        out.push("  # unsupported extern GetStdHandle call: nStdHandle must be register/literal");
        return true;
      }
      out.push(`  mov ecx, ${handle}`);
      out.push("  call GetStdHandle");
      return true;
    }
    case "WriteFile":
      emitWriteFile(stmt.call.args, out);
      return true;
    default:
      out.push(`  # unsupported extern link symbol '${link}' (decl '${short}')`);
      return true;
  }
}

function tryEmitExternMappedCallMasm(stmt: CallStmt, out: string[], ctx: Win64EmitCtx): boolean {
  const short = calleeShortName(stmt.call.callee);
  if (!short) {
    return false;
  }
  const link = ctx.externLinkByDeclName.get(short);
  if (!link) {
    return false;
  }
  switch (link) {
    case "ExitProcess": {
      const codeArg =
        findCallArg(stmt.call.args, ["uExitCode", "code"], 0);
      if (!codeArg) {
        out.push("  ; unsupported extern ExitProcess call: missing code argument");
        return true;
      }
      const code = exprToOperandMasm(codeArg.value);
      if (!code) {
        out.push("  ; unsupported extern ExitProcess call: non-literal/non-register argument");
        return true;
      }
      out.push(`  mov ecx, ${code}`);
      out.push("  call ExitProcess");
      return true;
    }
    case "GetStdHandle": {
      const handleArg = findCallArg(stmt.call.args, ["nStdHandle"], 0);
      if (!handleArg) {
        out.push("  ; unsupported extern GetStdHandle call: missing nStdHandle");
        return true;
      }
      const handle = exprToOperandMasm(handleArg.value);
      if (!handle) {
        out.push("  ; unsupported extern GetStdHandle call: nStdHandle must be register/literal");
        return true;
      }
      out.push(`  mov ecx, ${handle}`);
      out.push("  call GetStdHandle");
      return true;
    }
    case "WriteFile":
      emitWriteFileMasm(stmt.call.args, out);
      return true;
    default:
      out.push(`  ; unsupported extern link symbol '${link}' (decl '${short}')`);
      return true;
  }
}

function findCallArg(args: CallArg[], names: string[], fallbackIndex: number): CallArg | undefined {
  for (const name of names) {
    const found = args.find((arg) => arg.name?.text === name);
    if (found) {
      return found;
    }
  }
  return args[fallbackIndex];
}

function isOsCallName(stmt: CallStmt, shortName: string): boolean {
  return stmt.call.callee.kind === "IdentExpr" && stmt.call.callee.name.text === `os::${shortName}`;
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

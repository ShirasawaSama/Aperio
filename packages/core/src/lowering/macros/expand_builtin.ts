import type { CallArg, CallStmt, FileUnit, FnDecl, IdentExpr, Item, Stmt } from "@aperio/ast";

/** Built-in statement macros before codegen (v1: std/os/win friendly names). */
export function expandBuiltinMacros(file: FileUnit): FileUnit {
  const items: Item[] = file.items.map((item) => {
    if (item.kind !== "FnDecl") {
      return item;
    }
    const rewrittenFn: FnDecl = {
      ...item,
      body: rewriteStmtList(item.body),
    };
    return rewrittenFn;
  });
  return {
    ...file,
    items,
  };
}

function rewriteStmtList(stmts: Stmt[]): Stmt[] {
  return stmts.map((stmt) => rewriteStmt(stmt));
}

function rewriteStmt(stmt: Stmt): Stmt {
  if (stmt.kind === "IfStmt") {
    return {
      ...stmt,
      thenBody: rewriteStmtList(stmt.thenBody),
      elseBody: rewriteStmtList(stmt.elseBody),
    };
  }
  if (stmt.kind === "SaveStmt") {
    return {
      ...stmt,
      body: rewriteStmtList(stmt.body),
    };
  }
  if (stmt.kind === "CallStmt") {
    return rewriteCallStmt(stmt);
  }
  return stmt;
}

function rewriteCallStmt(stmt: CallStmt): Stmt {
  if (stmt.call.callee.kind !== "IdentExpr") {
    return stmt;
  }
  const calleeName = stmt.call.callee.name.text;
  if (calleeName === "os::exit") {
    return {
      ...stmt,
      call: {
        ...stmt.call,
        callee: rewriteCalleeName(stmt.call.callee, "os::exit_process"),
        args: rewriteArgNames(stmt.call.args, { code: "uExitCode" }),
      },
    };
  }
  if (calleeName === "os::write_stdout") {
    return {
      ...stmt,
      call: {
        ...stmt.call,
        callee: rewriteCalleeName(stmt.call.callee, "os::__macro_write_stdout"),
      },
    };
  }
  return stmt;
}

function rewriteCalleeName(callee: IdentExpr, newName: string): IdentExpr {
  return {
    ...callee,
    name: {
      ...callee.name,
      text: newName,
    },
  };
}

function rewriteArgNames(args: CallArg[], aliases: Record<string, string>): CallArg[] {
  return args.map((arg) => {
    if (!arg.name) {
      return arg;
    }
    const renamed = aliases[arg.name.text];
    if (!renamed) {
      return arg;
    }
    return {
      ...arg,
      name: {
        ...arg.name,
        text: renamed,
      },
    };
  });
}

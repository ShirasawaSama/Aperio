import { lex } from "@aperio/lexer";
import { expandBuiltinMacros } from "@aperio/core";
import { parseFile } from "@aperio/parser";
import { describe, expect, it } from "vitest";

describe("expandBuiltinMacros", () => {
  it("rewrites exit/write_stdout using the import alias prefix", () => {
    const src = [
      'import "std/os/win" as win',
      "",
      `val MSG: u8[] = "hi\n"`,
      "",
      "pub fn main() -> (r0: i32) {",
      "  win::exit(code = 0)",
      "  win::write_stdout(ptr = MSG, len = 3)",
      "  r0 = 0",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const parsed = parseFile("alias.ap", tokens);
    expect(parsed.diagnostics).toEqual([]);
    const out = expandBuiltinMacros(parsed.file);
    const main = out.items.find((i) => i.kind === "FnDecl" && i.name.text === "main");
    expect(main?.kind).toBe("FnDecl");
    if (main?.kind !== "FnDecl") {
      return;
    }
    const calls = main.body.filter((s) => s.kind === "CallStmt");
    const names = calls.map((c) =>
      c.kind === "CallStmt" && c.call.callee.kind === "IdentExpr" ? c.call.callee.name.text : "",
    );
    expect(names.some((n) => n === "win::exit_process")).toBe(true);
    expect(names.some((n) => n === "win::__macro_write_stdout")).toBe(true);
    expect(names.some((n) => n.includes("os::"))).toBe(false);
  });
});

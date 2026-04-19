import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { describe, expect, it } from "vitest";

describe("parser", () => {
  it("parses hello subset into FileUnit", () => {
    const src = 'import "std/io" as io\npub fn main() {}\n';
    const tokens = lex(1, src).tokens;
    const result = parseFile("hello.ap", tokens);
    expect(result.diagnostics).toEqual([]);
    expect(result.file).toMatchSnapshot();
  });

  it("parses strict signature and body statements", () => {
    const src = [
      "alias io_slot @ r9: i64",
      "pub extern fn puts(msg @ r0: *u8) -> r0: i32",
      "pub fn sum(a @ r0: i64, b @ r1: i64) -> (ret @ r0: i64) uses (tmp @ r10: i64) {",
      "  alias acc @ r2: i64",
      "  start:",
      "  acc = a + b",
      "  (r0, r1) = div(acc, b)",
      "  if r0 goto done",
      "  puts(msg=\"ok\")",
      "  done:",
      "  return r0",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const result = parseFile("strict.ap", tokens);
    expect(result.diagnostics).toEqual([]);
    expect(result.file).toMatchSnapshot();
  });

  it("parses top-level declarations for p0", () => {
    const src = [
      "const MAX: i32 = 1024",
      "val TABLE: u32[4] = [10, 20, 30, 40]",
      "var COUNTER: i32[1] = [0]",
      "type BinOp = fn(r1: i64, r2: i64) -> (r0: i64)",
      "struct Point {",
      "  x: i32,",
      "  y: i32,",
      "}",
      "macro swap!($a: reg, $b: reg) {",
      "  // body skipped for now",
      "}",
      "pub fn test(a @ r1: i64, b @ r2: i64) -> (r0: i64) {",
      "@entry:",
      "  if (a > b) goto(@gt)",
      "  goto(@done)",
      "@gt:",
      "  r0 = a",
      "  return r0",
      "@done:",
      "  r0 = b",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const result = parseFile("decls.ap", tokens);
    expect(result.diagnostics).toEqual([]);
    expect(result.file).toMatchSnapshot();
  });
});

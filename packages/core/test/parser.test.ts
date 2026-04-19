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
});

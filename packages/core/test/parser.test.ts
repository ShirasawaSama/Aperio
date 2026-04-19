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
});

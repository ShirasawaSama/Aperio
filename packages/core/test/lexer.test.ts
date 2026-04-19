import { lex } from "@aperio/lexer";
import { describe, expect, it } from "vitest";

describe("lexer", () => {
  it("tokenizes hello fixture subset", () => {
    const src = 'import "std/io" as io\npub fn main() {}\n';
    const result = lex(1, src);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.tokens.map((t) => ({
        kind: t.kind,
        text: t.text,
      })),
    ).toMatchSnapshot();
  });
});

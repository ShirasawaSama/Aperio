import { lex } from "@aperio/lexer";
import { runMidendPipeline } from "@aperio/core";
import { parseFile } from "@aperio/parser";
import { describe, expect, it } from "vitest";

describe("runMidendPipeline", () => {
  it("runs guard, macro expand, and semantic in one step", () => {
    const src = 'import "std/io" as io\npub fn main() {}\n';
    const parsed = parseFile("t.ap", lex(1, src).tokens);
    expect(parsed.diagnostics).toEqual([]);
    const { expanded, diagnostics } = runMidendPipeline(parsed.file, "std");
    expect(expanded).toBeDefined();
    expect(Array.isArray(diagnostics)).toBe(true);
  });
});

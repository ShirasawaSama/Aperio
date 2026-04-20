import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { lowerAstToLlvmIr } from "../../src/lowering/ast_to_llvm/index.js";
import { describe, expect, it } from "vitest";

describe("lowering/ast_to_llvm", () => {
  it("returns E8001 contract diagnostic before implementation lands", () => {
    const src = [
      "fn main() -> (r0: i32) {",
      "  r0 = 0",
      "}",
      "",
    ].join("\n");
    const parsed = parseFile("main.ap", lex(1, src).tokens);
    expect(parsed.diagnostics).toEqual([]);

    const lowered = lowerAstToLlvmIr({ source: parsed.file });
    expect(lowered.output).toBeUndefined();
    expect(lowered.diagnostics.some((d) => d.code === "E8001")).toBe(true);
  });
});

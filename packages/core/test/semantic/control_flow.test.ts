import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { runSemantic } from "@aperio/semantic";
import { describe, expect, it } from "vitest";

describe("semantic/control_flow", () => {
  it("checks call ruleA and goto inward jump", () => {
    const src = [
      "fn callee(r0: i32, r1: i32) -> (r0: i32) {",
      "  return r0",
      "}",
      "fn test(r0: i32, r1: i32) -> (r0: i32) {",
      "  save (r0) {",
      "  @inner(r0: i32):",
      "    callee(r1, r0)",
      "  }",
      "  goto(@inner(r0))",
      "  return r0",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const parsed = parseFile("semantic_new.ap", tokens);
    expect(parsed.diagnostics).toEqual([]);
    const semantic = runSemantic(parsed.file);
    expect(semantic.diagnostics.some((d) => d.code === "E4010")).toBe(true);
    expect(semantic.diagnostics.some((d) => d.code === "E4016")).toBe(true);
  });

  it("reports if-else merge type mismatch", () => {
    const src = [
      "fn merge_bad(r1: i32, r2: i32) -> (r0: i32) {",
      "  if (r1 > r2) {",
      "    r3 = 1",
      "  } else {",
      "    r3 = true",
      "  }",
      "  r0 = r1",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const parsed = parseFile("merge_bad.ap", tokens);
    expect(parsed.diagnostics).toEqual([]);
    const semantic = runSemantic(parsed.file);
    expect(semantic.diagnostics.some((d) => d.code === "E4017")).toBe(true);
  });

  it("reports inconsistent incoming types on label parameters", () => {
    const src = [
      "fn label_merge_bad(r1: i32, r2: i32) -> (r0: i32) {",
      "  if (r1 > r2) {",
      "    r3 = 1",
      "    goto(@join(r3))",
      "  } else {",
      "    r3 = true",
      "    goto(@join(r3))",
      "  }",
      "@join(r3):",
      "  r0 = r1",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const parsed = parseFile("label_merge_bad.ap", tokens);
    expect(parsed.diagnostics).toEqual([]);
    const semantic = runSemantic(parsed.file);
    expect(semantic.diagnostics.some((d) => d.code === "E4018")).toBe(true);
  });

  it("reports inconsistent incoming state between goto and fallthrough", () => {
    const src = [
      "fn cfg_merge_bad(r1: i32, r2: i32) -> (r0: i32) {",
      "  if (r1 > r2) goto(@join)",
      "  r1 = true",
      "@join:",
      "  r0 = r2",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const parsed = parseFile("cfg_merge_bad.ap", tokens);
    expect(parsed.diagnostics).toEqual([]);
    const semantic = runSemantic(parsed.file);
    expect(semantic.diagnostics.some((d) => d.code === "E4019")).toBe(true);
  });

  it("reports inconsistent incoming state across multiple goto predecessors", () => {
    const src = [
      "fn cfg_multi_goto_bad(r1: i32, r2: i32) -> (r0: i32) {",
      "  if (r1 > r2) goto(@left)",
      "  goto(@right)",
      "@left:",
      "  r4 = 1",
      "  goto(@join)",
      "@right:",
      "  r4 = true",
      "  goto(@join)",
      "@join:",
      "  r0 = r1",
      "}",
      "",
    ].join("\n");
    const tokens = lex(1, src).tokens;
    const parsed = parseFile("cfg_multi_goto_bad.ap", tokens);
    expect(parsed.diagnostics).toEqual([]);
    const semantic = runSemantic(parsed.file);
    expect(semantic.diagnostics.some((d) => d.code === "E4019")).toBe(true);
  });
});

import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { lowerStdToNativeAst } from "../../src/lowering/std_to_native/index.js";
import { describe, expect, it } from "vitest";

describe("lowering/std_to_native", () => {
  it("lowers structured if into labels and gotos", () => {
    const src = [
      "fn f(r1: i64, r2: i64) -> (r0: i64) {",
      "  if (r1 > r2) {",
      "    r0 = r1",
      "  } else {",
      "    r0 = r2",
      "  }",
      "}",
      "",
    ].join("\n");
    const parsed = parseFile("if.ap", lex(1, src).tokens);
    expect(parsed.diagnostics).toEqual([]);

    const lowered = lowerStdToNativeAst({ source: parsed.file });
    expect(lowered.diagnostics).toEqual([]);
    const fn = lowered.output?.items.find((item) => item.kind === "FnDecl");
    expect(fn?.kind).toBe("FnDecl");
    if (!fn || fn.kind !== "FnDecl") {
      return;
    }
    expect(fn.body.some((stmt) => stmt.kind === "IfStmt")).toBe(false);
    expect(fn.body.some((stmt) => stmt.kind === "IfGotoStmt")).toBe(true);
    expect(fn.body.some((stmt) => stmt.kind === "LabelStmt")).toBe(true);
  });

  it("lowers save into explicit save/restore assignments", () => {
    const src = [
      "fn f(r1: i64, r2: i64) -> (r0: i64) {",
      "  save (r1, r2) {",
      "    r0 = r1 + r2",
      "  }",
      "}",
      "",
    ].join("\n");
    const parsed = parseFile("save.ap", lex(1, src).tokens);
    expect(parsed.diagnostics).toEqual([]);

    const lowered = lowerStdToNativeAst({ source: parsed.file });
    expect(lowered.diagnostics).toEqual([]);
    const fn = lowered.output?.items.find((item) => item.kind === "FnDecl");
    expect(fn?.kind).toBe("FnDecl");
    if (!fn || fn.kind !== "FnDecl") {
      return;
    }
    expect(fn.body.some((stmt) => stmt.kind === "SaveStmt")).toBe(false);
    const assigns = fn.body.filter((stmt) => stmt.kind === "AssignStmt");
    expect(assigns.length).toBeGreaterThanOrEqual(3);
    const targetNames = assigns.map((stmt) => (stmt.kind === "AssignStmt" ? stmt.target.name : ""));
    expect(targetNames).toContain("r1");
    expect(targetNames).toContain("r2");
  });
});

import type { Diagnostic, SourceMap } from "@aperio/diagnostics";
import { renderDiagnosticsHuman } from "@aperio/diagnostics";
import { describe, expect, it } from "vitest";

describe("diagnostics renderer", () => {
  it("renders rustc-like human output", () => {
    const map: SourceMap = {
      toSourceRange() {
        return {
          start: { fileId: 1, line: 2, column: 3 },
          end: { fileId: 1, line: 2, column: 5 },
        };
      },
    };
    const diags: Diagnostic[] = [
      {
        code: "E1002",
        severity: "error",
        message: "unexpected character '@'",
        primary: { span: { fileId: 1, start: 1, end: 2 }, message: "invalid token" },
        secondary: [],
        notes: ["lexer recovered by skipping this byte"],
        fixes: [],
      },
    ];
    expect(renderDiagnosticsHuman(diags, map)).toMatchSnapshot();
  });
});

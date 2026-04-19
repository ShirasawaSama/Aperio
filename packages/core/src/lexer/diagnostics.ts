import type { Diagnostic } from "@aperio/diagnostics";
import { span } from "@aperio/diagnostics";

export function unterminatedStringDiag(fileId: number, start: number, end: number): Diagnostic {
  return {
    code: "E1001",
    severity: "error",
    message: "unterminated string literal",
    primary: { span: span(fileId, start, end), message: "string starts here" },
    secondary: [],
    notes: ["lexer recovered by consuming until end-of-file"],
    fixes: [],
  };
}

export function unexpectedCharDiag(fileId: number, at: number, ch: string): Diagnostic {
  return {
    code: "E1002",
    severity: "error",
    message: `unexpected character '${ch}'`,
    primary: { span: span(fileId, at, at + 1), message: "invalid token" },
    secondary: [],
    notes: ["lexer recovered by skipping this byte"],
    fixes: [],
  };
}

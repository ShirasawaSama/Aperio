import type { Diagnostic } from "@aperio/diagnostics";
import { span } from "@aperio/diagnostics";
import type { Token } from "./token.js";
import { Keywords } from "./token.js";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

// Minimal lexer with recovery:
// invalid bytes are reported and skipped, so parser can still continue.
export function lex(fileId: number, source: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "\n") {
      tokens.push({ kind: "Newline", text: "\n", span: span(fileId, i, i + 1) });
      i += 1;
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (isIdentStart(ch)) {
      const start = i;
      i += 1;
      while (i < source.length && isIdentContinue(source[i])) {
        i += 1;
      }
      const text = source.slice(start, i);
      tokens.push({
        kind: Keywords.has(text) ? "Keyword" : "Ident",
        text,
        span: span(fileId, start, i),
      });
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      i += 1;
      while (i < source.length && isDigit(source[i])) {
        i += 1;
      }
      tokens.push({
        kind: "IntLiteral",
        text: source.slice(start, i),
        span: span(fileId, start, i),
      });
      continue;
    }

    if (ch === '"') {
      const start = i;
      i += 1;
      let terminated = false;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i += 1;
          terminated = true;
          break;
        }
        i += 1;
      }
      if (!terminated) {
        diagnostics.push({
          code: "E1001",
          severity: "error",
          message: "unterminated string literal",
          primary: { span: span(fileId, start, i), message: "string starts here" },
          secondary: [],
          notes: ["lexer recovered by consuming until end-of-file"],
          fixes: [],
        });
      }
      tokens.push({
        kind: "StringLiteral",
        text: source.slice(start, i),
        span: span(fileId, start, i),
      });
      continue;
    }

    if (isSymbol(ch)) {
      tokens.push({ kind: "Symbol", text: ch, span: span(fileId, i, i + 1) });
      i += 1;
      continue;
    }

    diagnostics.push({
      code: "E1002",
      severity: "error",
      message: `unexpected character '${ch}'`,
      primary: { span: span(fileId, i, i + 1), message: "invalid token" },
      secondary: [],
      notes: ["lexer recovered by skipping this byte"],
      fixes: [],
    });
    i += 1;
  }

  tokens.push({ kind: "Eof", text: "", span: span(fileId, source.length, source.length) });
  return { tokens, diagnostics };
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentContinue(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}

function isSymbol(ch: string): boolean {
  return "(){}[],:=+-*/@.&<>!".includes(ch);
}

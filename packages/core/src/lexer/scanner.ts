import { span } from "@aperio/diagnostics";
import { isDigit, isIdentContinue, isIdentStart, isSymbol } from "./char.js";
import { LexerCursor } from "./cursor.js";
import { unexpectedCharDiag, unterminatedStringDiag } from "./diagnostics.js";
import type { Token } from "./token.js";
import { Keywords } from "./token.js";
import type { LexResult } from "./types.js";

// Token scanner split from entry to keep lexer maintainable.
export function scanTokens(fileId: number, source: string): LexResult {
  const cursor = new LexerCursor(fileId, source);
  const tokens: Token[] = [];
  const diagnostics = [];

  while (!cursor.eof()) {
    const ch = cursor.current();
    if (ch === undefined) {
      break;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      cursor.advance();
      continue;
    }

    if (ch === "\n") {
      tokens.push({
        kind: "Newline",
        text: "\n",
        span: span(fileId, cursor.index, cursor.index + 1),
      });
      cursor.advance();
      continue;
    }

    if (ch === "/" && cursor.peek() === "/") {
      while (!cursor.eof() && cursor.current() !== "\n") {
        cursor.advance();
      }
      continue;
    }

    if (isIdentStart(ch)) {
      const start = cursor.index;
      cursor.advance();
      while (!cursor.eof()) {
        const c = cursor.current();
        if (c === undefined || !isIdentContinue(c)) {
          break;
        }
        cursor.advance();
      }
      const text = source.slice(start, cursor.index);
      tokens.push({
        kind: Keywords.has(text) ? "Keyword" : "Ident",
        text,
        span: span(fileId, start, cursor.index),
      });
      continue;
    }

    if (isDigit(ch)) {
      const start = cursor.index;
      cursor.advance();
      while (!cursor.eof()) {
        const c = cursor.current();
        if (c === undefined || !isDigit(c)) {
          break;
        }
        cursor.advance();
      }
      tokens.push({
        kind: "IntLiteral",
        text: source.slice(start, cursor.index),
        span: span(fileId, start, cursor.index),
      });
      continue;
    }

    if (ch === '"') {
      const start = cursor.index;
      cursor.advance();
      let terminated = false;
      while (!cursor.eof()) {
        const c = cursor.current();
        if (c === undefined) {
          break;
        }
        if (c === "\\") {
          cursor.advance(2);
          continue;
        }
        if (c === '"') {
          cursor.advance();
          terminated = true;
          break;
        }
        cursor.advance();
      }
      if (!terminated) {
        diagnostics.push(unterminatedStringDiag(fileId, start, cursor.index));
      }
      tokens.push({
        kind: "StringLiteral",
        text: source.slice(start, cursor.index),
        span: span(fileId, start, cursor.index),
      });
      continue;
    }

    if (isSymbol(ch)) {
      tokens.push({
        kind: "Symbol",
        text: ch,
        span: span(fileId, cursor.index, cursor.index + 1),
      });
      cursor.advance();
      continue;
    }

    diagnostics.push(unexpectedCharDiag(fileId, cursor.index, ch));
    cursor.advance();
  }

  tokens.push({
    kind: "Eof",
    text: "",
    span: span(fileId, source.length, source.length),
  });
  return { tokens, diagnostics };
}

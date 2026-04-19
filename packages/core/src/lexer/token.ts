import type { Span } from "@aperio/diagnostics";

export type TokenKind =
  | "Ident"
  | "IntLiteral"
  | "StringLiteral"
  | "Keyword"
  | "Symbol"
  | "Newline"
  | "Eof";

export interface Token {
  kind: TokenKind;
  text: string;
  span: Span;
}

export const Keywords = new Set([
  "fn",
  "extern",
  "import",
  "as",
  "pub",
  "export",
  "uses",
  "return",
  "goto",
  "if",
  "alias",
  "const",
  "val",
  "var",
  "struct",
  "type",
  "macro",
  "true",
  "false",
]);

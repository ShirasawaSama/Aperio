import type { Token } from "@aperio/lexer";

// Very small panic-mode recovery.
// We sync on newline or closing brace to keep parser moving.
export function recoverIndex(tokens: Token[], from: number): number {
  let i = from;
  while (i < tokens.length) {
    const tk = tokens[i];
    if (!tk) {
      return tokens.length;
    }
    if (tk.kind === "Newline" || (tk.kind === "Symbol" && tk.text === "}")) {
      return i + 1;
    }
    i += 1;
  }
  return tokens.length;
}

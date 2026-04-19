import type { FileUnit, Ident, Item } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { span } from "@aperio/diagnostics";
import type { Token } from "@aperio/lexer";
import { recoverIndex } from "./recovery.js";

export class ParserState {
  public index = 0;
  public nextNodeId = 1;
  public readonly diagnostics: Diagnostic[] = [];
  public readonly items: Item[] = [];
  public readonly fileId: number;

  public constructor(
    public readonly path: string,
    public readonly tokens: Token[],
  ) {
    this.fileId = tokens[0]?.span.fileId ?? 1;
  }

  public fileUnit(): FileUnit {
    const end = this.current()?.span.end ?? 0;
    return {
      id: this.id(),
      kind: "FileUnit",
      path: this.path,
      span: span(this.fileId, 0, end),
      items: this.items,
    };
  }

  public parseIdent(message: string): Ident | undefined {
    const token = this.consume((t) => t.kind === "Ident", message);
    if (!token) {
      return undefined;
    }
    return { id: this.id(), kind: "Ident", span: token.span, text: token.text };
  }

  public unsupported(message: string): void {
    const tk = this.current();
    if (tk) {
      this.diagnostics.push({
        code: "E2999",
        severity: "error",
        message,
        primary: { span: tk.span, message: "parser TODO" },
        secondary: [],
        notes: ["v1 parser intentionally supports only a minimal hello-world subset"],
        fixes: [],
      });
      this.index = Math.min(recoverIndex(this.tokens, this.index + 1), this.tokens.length - 1);
    } else {
      this.index = this.tokens.length - 1;
    }
  }

  public error(token: Token | undefined, code: string, message: string): void {
    const fallback = token?.span ?? span(this.fileId, 0, 0);
    this.diagnostics.push({
      code,
      severity: "error",
      message,
      primary: { span: fallback, message },
      secondary: [],
      notes: [],
      fixes: [],
    });
  }

  public matchKeyword(text: string): boolean {
    const tk = this.current();
    if (tk && tk.kind === "Keyword" && tk.text === text) {
      this.index += 1;
      return true;
    }
    return false;
  }

  public peekKeyword(text: string): boolean {
    const tk = this.current();
    return tk?.kind === "Keyword" && tk.text === text;
  }

  public checkKeyword(text: string, offset = 0): boolean {
    const tk = this.peek(offset);
    return tk?.kind === "Keyword" && tk.text === text;
  }

  public matchSymbol(text: string): boolean {
    const tk = this.current();
    if (tk && tk.kind === "Symbol" && tk.text === text) {
      this.index += 1;
      return true;
    }
    return false;
  }

  public checkSymbol(text: string, offset = 0): boolean {
    const tk = this.peek(offset);
    return tk?.kind === "Symbol" && tk.text === text;
  }

  public matchSymbolSequence(...symbols: string[]): boolean {
    for (let i = 0; i < symbols.length; i += 1) {
      if (!this.checkSymbol(symbols[i] as string, i)) {
        return false;
      }
    }
    this.index += symbols.length;
    return true;
  }

  public matchNewline(): boolean {
    const tk = this.current();
    if (tk?.kind === "Newline") {
      this.index += 1;
      return true;
    }
    return false;
  }

  public consume(predicate: (token: Token) => boolean, message: string): Token | undefined {
    const tk = this.current();
    if (tk && predicate(tk)) {
      this.index += 1;
      return tk;
    }
    this.error(tk, "E2001", message);
    return undefined;
  }

  public consumeSymbol(text: string, message: string): Token | undefined {
    const tk = this.current();
    if (tk && tk.kind === "Symbol" && tk.text === text) {
      this.index += 1;
      return tk;
    }
    this.error(tk, "E2001", message);
    return undefined;
  }

  public current(): Token | undefined {
    return this.tokens[this.index];
  }

  public peek(offset = 0): Token | undefined {
    return this.tokens[this.index + offset];
  }

  public previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)] as Token;
  }

  public at(kind: Token["kind"]): boolean {
    const tk = this.current();
    if (!tk) {
      return kind === "Eof";
    }
    return tk.kind === kind;
  }

  public id(): number {
    const id = this.nextNodeId;
    this.nextNodeId += 1;
    return id;
  }
}

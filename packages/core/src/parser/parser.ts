import type { FileUnit, FnDecl, Ident, ImportDecl, Item, SlotBinding } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { span } from "@aperio/diagnostics";
import type { Token } from "@aperio/lexer";
import { recoverIndex } from "./recovery.js";

export interface ParseResult {
  file: FileUnit;
  diagnostics: Diagnostic[];
}

// Recursive-descent parser skeleton.
// v1 target: parse import lines and minimal fn declarations.
export function parseFile(path: string, tokens: Token[]): ParseResult {
  const p = new Parser(path, tokens);
  return p.parse();
}

class Parser {
  private index = 0;
  private nextNodeId = 1;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly items: Item[] = [];
  private readonly fileId: number;

  public constructor(
    private readonly path: string,
    private readonly tokens: Token[],
  ) {
    this.fileId = tokens[0]?.span.fileId ?? 1;
  }

  public parse(): ParseResult {
    while (this.index < this.tokens.length && !this.at("Eof")) {
      if (this.matchNewline()) {
        continue;
      }
      if (this.matchKeyword("import")) {
        const node = this.parseImportDecl();
        if (node) {
          this.items.push(node);
        }
        continue;
      }
      if (this.peekKeyword("pub") || this.peekKeyword("fn")) {
        const node = this.parseFnDecl();
        if (node) {
          this.items.push(node);
        }
        continue;
      }
      this.unsupported("top-level syntax is not implemented yet");
    }

    const end = this.current()?.span.end ?? 0;
    const file: FileUnit = {
      id: this.id(),
      kind: "FileUnit",
      path: this.path,
      span: span(this.fileId, 0, end),
      items: this.items,
    };
    return { file, diagnostics: this.diagnostics };
  }

  private parseImportDecl(): ImportDecl | undefined {
    const kw = this.previous();
    const pathToken = this.consume(
      (t) => t.kind === "StringLiteral",
      "expected import path string",
    );
    if (!pathToken) {
      return undefined;
    }
    if (!this.matchKeyword("as")) {
      this.error(pathToken, "E2002", "expected 'as' in import declaration");
      return undefined;
    }
    const alias = this.parseIdent("expected import alias");
    if (!alias) {
      return undefined;
    }
    return {
      id: this.id(),
      kind: "ImportDecl",
      span: span(this.fileId, kw.span.start, alias.span.end),
      path: unquote(pathToken.text),
      alias,
    };
  }

  private parseFnDecl(): FnDecl | undefined {
    const start = this.current()?.span.start ?? 0;
    this.matchKeyword("pub");
    if (!this.matchKeyword("fn")) {
      this.error(this.current(), "E2003", "expected 'fn'");
      return undefined;
    }
    const name = this.parseIdent("expected function name");
    if (!name) {
      return undefined;
    }

    // v1 parser supports `fn name() {}` shape only.
    if (!this.matchSymbol("(")) {
      this.unsupported("function parameters are not implemented yet");
      return undefined;
    }
    if (!this.matchSymbol(")")) {
      this.unsupported("function parameters are not implemented yet");
      return undefined;
    }

    if (!this.matchSymbol("{")) {
      this.error(this.current(), "E2004", "expected '{' to start function body");
      return undefined;
    }
    while (!this.at("Eof") && !this.matchSymbol("}")) {
      if (this.matchNewline()) {
        continue;
      }
      this.unsupported("function statement parsing is not implemented yet");
    }
    const end = this.previous()?.span.end ?? start;
    return {
      id: this.id(),
      kind: "FnDecl",
      span: span(this.fileId, start, end),
      name,
      params: [] as SlotBinding[],
      returns: [],
      uses: [],
      attrs: [],
      body: [],
    };
  }

  private parseIdent(message: string): Ident | undefined {
    const token = this.consume((t) => t.kind === "Ident", message);
    if (!token) {
      return undefined;
    }
    return { id: this.id(), kind: "Ident", span: token.span, text: token.text };
  }

  private unsupported(message: string): void {
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

  private error(token: Token | undefined, code: string, message: string): void {
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

  private matchKeyword(text: string): boolean {
    const tk = this.current();
    if (tk && tk.kind === "Keyword" && tk.text === text) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private peekKeyword(text: string): boolean {
    const tk = this.current();
    return tk?.kind === "Keyword" && tk.text === text;
  }

  private matchSymbol(text: string): boolean {
    const tk = this.current();
    if (tk && tk.kind === "Symbol" && tk.text === text) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private matchNewline(): boolean {
    const tk = this.current();
    if (tk?.kind === "Newline") {
      this.index += 1;
      return true;
    }
    return false;
  }

  private consume(predicate: (token: Token) => boolean, message: string): Token | undefined {
    const tk = this.current();
    if (tk && predicate(tk)) {
      this.index += 1;
      return tk;
    }
    this.error(tk, "E2001", message);
    return undefined;
  }

  private current(): Token | undefined {
    return this.tokens[this.index];
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)];
  }

  private at(kind: Token["kind"]): boolean {
    const tk = this.current();
    if (!tk) {
      return kind === "Eof";
    }
    return tk.kind === kind;
  }

  private id(): number {
    const id = this.nextNodeId;
    this.nextNodeId += 1;
    return id;
  }
}

function unquote(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1);
  }
  return raw;
}

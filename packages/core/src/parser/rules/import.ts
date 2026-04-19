import type { ImportDecl } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";

// Parse `import "path" as alias` declarations.
export function parseImportDecl(state: ParserState): ImportDecl | undefined {
  const kw = state.previous();
  const pathToken = state.consume((t) => t.kind === "StringLiteral", "expected import path string");
  if (!pathToken) {
    return undefined;
  }
  if (!state.matchKeyword("as")) {
    state.error(pathToken, "E2002", "expected 'as' in import declaration");
    return undefined;
  }
  const alias = state.parseIdent("expected import alias");
  if (!alias) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "ImportDecl",
    span: span(state.fileId, kw.span.start, alias.span.end),
    path: unquote(pathToken.text),
    alias,
  };
}

function unquote(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1);
  }
  return raw;
}

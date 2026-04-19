import type { FileAliasDecl } from "@aperio/ast";
import { span } from "@aperio/diagnostics";
import type { ParserState } from "../state.js";
import { parseSlotBinding } from "./shared.js";

// Parse top-level alias declaration: `alias name @ r0: i64`
export function parseFileAliasDecl(state: ParserState): FileAliasDecl | undefined {
  const start = state.previous().span.start;
  const binding = parseSlotBinding(state);
  if (!binding) {
    return undefined;
  }
  return {
    id: state.id(),
    kind: "FileAliasDecl",
    span: span(state.fileId, start, binding.span.end),
    binding,
  };
}

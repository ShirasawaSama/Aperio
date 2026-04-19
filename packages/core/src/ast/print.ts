import type { FileUnit, Node } from "./nodes.js";

// Deterministic AST printer used by tests and `aperio ast`.
export function printAst(node: Node | FileUnit): string {
  return JSON.stringify(node, null, 2);
}

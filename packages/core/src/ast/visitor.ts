import type {
  Attribute,
  BaseNode,
  BinaryExpr,
  CallArg,
  CallExpr,
  CastExpr,
  FileAliasDecl,
  FileUnit,
  FnBodyAliasDecl,
  FnDecl,
  GotoStmt,
  IfStmt,
  IfGotoStmt,
  ImportDecl,
  LabelStmt,
  LeaExpr,
  MemAccessExpr,
  Node,
  StructDecl,
  TuplePattern,
  UnaryExpr,
  SaveStmt,
} from "./nodes.js";

export interface AstVisitor {
  enter?(node: BaseNode): void;
  leave?(node: BaseNode): void;
  onFileUnit?(node: FileUnit): void;
  onFnDecl?(node: FnDecl): void;
  onStructDecl?(node: StructDecl): void;
  onImportDecl?(node: ImportDecl): void;
  onFileAliasDecl?(node: FileAliasDecl): void;
  onFnBodyAliasDecl?(node: FnBodyAliasDecl): void;
  onGotoStmt?(node: GotoStmt): void;
  onSaveStmt?(node: SaveStmt): void;
  onIfStmt?(node: IfStmt): void;
  onIfGotoStmt?(node: IfGotoStmt): void;
  onLabelStmt?(node: LabelStmt): void;
  onCallExpr?(node: CallExpr): void;
  onCallArg?(node: CallArg): void;
  onBinaryExpr?(node: BinaryExpr): void;
  onUnaryExpr?(node: UnaryExpr): void;
  onCastExpr?(node: CastExpr): void;
  onMemAccessExpr?(node: MemAccessExpr): void;
  onLeaExpr?(node: LeaExpr): void;
  onTuplePattern?(node: TuplePattern): void;
  onAttribute?(node: Attribute): void;
}

// Generic DFS traversal used by lint/type/alias passes.
export function walk(node: Node | FileUnit, visitor: AstVisitor): void {
  visitor.enter?.(node);
  dispatch(node, visitor);
  for (const child of childrenOf(node)) {
    walk(child, visitor);
  }
  visitor.leave?.(node);
}

function dispatch(node: Node | FileUnit, v: AstVisitor): void {
  switch (node.kind) {
    case "FileUnit":
      v.onFileUnit?.(node);
      return;
    case "FnDecl":
      v.onFnDecl?.(node);
      return;
    case "StructDecl":
      v.onStructDecl?.(node);
      return;
    case "ImportDecl":
      v.onImportDecl?.(node);
      return;
    case "FileAliasDecl":
      v.onFileAliasDecl?.(node);
      return;
    case "FnBodyAliasDecl":
      v.onFnBodyAliasDecl?.(node);
      return;
    case "GotoStmt":
      v.onGotoStmt?.(node);
      return;
    case "SaveStmt":
      v.onSaveStmt?.(node);
      return;
    case "IfStmt":
      v.onIfStmt?.(node);
      return;
    case "IfGotoStmt":
      v.onIfGotoStmt?.(node);
      return;
    case "LabelStmt":
      v.onLabelStmt?.(node);
      return;
    case "CallExpr":
      v.onCallExpr?.(node);
      return;
    case "CallArg":
      v.onCallArg?.(node);
      return;
    case "BinaryExpr":
      v.onBinaryExpr?.(node);
      return;
    case "UnaryExpr":
      v.onUnaryExpr?.(node);
      return;
    case "CastExpr":
      v.onCastExpr?.(node);
      return;
    case "MemAccessExpr":
      v.onMemAccessExpr?.(node);
      return;
    case "LeaExpr":
      v.onLeaExpr?.(node);
      return;
    case "TuplePattern":
      v.onTuplePattern?.(node);
      return;
    case "Attribute":
      v.onAttribute?.(node);
      return;
    default:
      return;
  }
}

function childrenOf(node: Node | FileUnit): BaseNode[] {
  const result: BaseNode[] = [];
  for (const value of Object.values(node)) {
    if (isNode(value)) {
      result.push(value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          result.push(item);
        }
      }
    }
  }
  return result;
}

function isNode(value: unknown): value is BaseNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "id" in value &&
    "span" in value
  );
}

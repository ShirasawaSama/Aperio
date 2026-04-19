import type { Span } from "@aperio/diagnostics";

export type NodeId = number;

// Base node shared by all AST variants.
export interface BaseNode {
  id: NodeId;
  kind: string;
  span: Span;
}

export type Node = Item | Stmt | Expr | Pattern;

export type Item =
  | FnDecl
  | ExternFnDecl
  | ConstDecl
  | ValDecl
  | VarDecl
  | StructDecl
  | TypeAliasDecl
  | ImportDecl
  | MacroDecl
  | FileAliasDecl;

export type Stmt =
  | AssignStmt
  | MultiAssignStmt
  | CallStmt
  | ReturnStmt
  | GotoStmt
  | LabelStmt
  | IfGotoStmt
  | FnBodyAliasDecl
  | IfExprStmt // loose-only
  | WhileStmt // loose-only
  | ForStmt; // loose-only

export type Expr =
  | LiteralExpr
  | RegRefExpr
  | IdentExpr
  | CallExpr
  | BinaryExpr
  | UnaryExpr
  | CastExpr
  | MemAccessExpr
  | AddrOfExpr
  | FieldOfExpr
  | LeaExpr; // native-x86-only

export type Pattern = TuplePattern;

export interface FileUnit extends BaseNode {
  kind: "FileUnit";
  path: string;
  items: Item[];
}

export interface Ident extends BaseNode {
  kind: "Ident";
  text: string;
}

export interface TypeExpr extends BaseNode {
  kind: "TypeExpr";
  typeKind: "prim" | "ptr" | "fn" | "named";
  name: string;
  params?: TypeExpr[];
}

// SlotBinding supports aliasing syntax: alias @ rN: T
export interface SlotBinding extends BaseNode {
  kind: "SlotBinding";
  alias: Ident;
  slot: RegRefExpr;
  type?: TypeExpr;
}

export interface FnDecl extends BaseNode {
  kind: "FnDecl";
  name: Ident;
  params: SlotBinding[];
  returns: SlotBinding[];
  uses: SlotBinding[];
  attrs: Attribute[];
  body: Stmt[];
}

export interface ExternFnDecl extends BaseNode {
  kind: "ExternFnDecl";
  name: Ident;
  params: SlotBinding[];
  returns: SlotBinding[];
  variadic: boolean;
  attrs: Attribute[];
}

export interface ConstDecl extends BaseNode {
  kind: "ConstDecl";
  name: Ident;
  type: TypeExpr;
  value: Expr;
}

export interface ValDecl extends BaseNode {
  kind: "ValDecl";
  name: Ident;
  type: TypeExpr;
  init?: Expr;
}

export interface VarDecl extends BaseNode {
  kind: "VarDecl";
  name: Ident;
  type: TypeExpr;
  init?: Expr;
}

export interface StructField extends BaseNode {
  kind: "StructField";
  name: Ident;
  type: TypeExpr;
}

export interface StructDecl extends BaseNode {
  kind: "StructDecl";
  name: Ident;
  fields: StructField[];
}

export interface TypeAliasDecl extends BaseNode {
  kind: "TypeAliasDecl";
  name: Ident;
  target: TypeExpr;
}

export interface ImportDecl extends BaseNode {
  kind: "ImportDecl";
  path: string;
  alias: Ident;
}

export interface MacroParam extends BaseNode {
  kind: "MacroParam";
  name: Ident;
  fragment: string;
}

export interface MacroDecl extends BaseNode {
  kind: "MacroDecl";
  name: Ident;
  params: MacroParam[];
  body: Stmt[];
}

export interface FileAliasDecl extends BaseNode {
  kind: "FileAliasDecl";
  binding: SlotBinding;
}

export interface FnBodyAliasDecl extends BaseNode {
  kind: "FnBodyAliasDecl";
  binding: SlotBinding;
}

export interface AssignStmt extends BaseNode {
  kind: "AssignStmt";
  target: RegRefExpr;
  value: Expr;
}

export interface MultiAssignStmt extends BaseNode {
  kind: "MultiAssignStmt";
  pattern: TuplePattern;
  value: Expr;
}

export interface CallStmt extends BaseNode {
  kind: "CallStmt";
  call: CallExpr;
}

export interface ReturnStmt extends BaseNode {
  kind: "ReturnStmt";
  values: Expr[];
}

export interface GotoStmt extends BaseNode {
  kind: "GotoStmt";
  label: Ident;
}

export interface LabelStmt extends BaseNode {
  kind: "LabelStmt";
  label: Ident;
}

export interface IfGotoStmt extends BaseNode {
  kind: "IfGotoStmt";
  condition: Expr;
  target: Ident;
}

export interface IfExprStmt extends BaseNode {
  kind: "IfExprStmt";
  condition: Expr;
  thenBody: Stmt[];
  elseBody: Stmt[];
}

export interface WhileStmt extends BaseNode {
  kind: "WhileStmt";
  condition: Expr;
  body: Stmt[];
}

export interface ForStmt extends BaseNode {
  kind: "ForStmt";
  init?: Stmt;
  condition?: Expr;
  step?: Stmt;
  body: Stmt[];
}

export interface LiteralExpr extends BaseNode {
  kind: "LiteralExpr";
  literalKind: "int" | "float" | "bool" | "string" | "char";
  value: string;
}

export interface RegRefExpr extends BaseNode {
  kind: "RegRefExpr";
  name: string;
}

export interface IdentExpr extends BaseNode {
  kind: "IdentExpr";
  name: Ident;
}

export interface CallArg extends BaseNode {
  kind: "CallArg";
  name?: Ident;
  value: Expr;
}

export interface CallExpr extends BaseNode {
  kind: "CallExpr";
  callee: Expr;
  args: CallArg[];
}

export interface BinaryExpr extends BaseNode {
  kind: "BinaryExpr";
  op: string;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends BaseNode {
  kind: "UnaryExpr";
  op: string;
  value: Expr;
}

export interface CastExpr extends BaseNode {
  kind: "CastExpr";
  value: Expr;
  type: TypeExpr;
}

export interface MemAccessExpr extends BaseNode {
  kind: "MemAccessExpr";
  memoryType: TypeExpr;
  volatile: boolean;
  unaligned: boolean;
  address: Expr;
}

export interface AddrOfExpr extends BaseNode {
  kind: "AddrOfExpr";
  value: Expr;
}

export interface FieldOfExpr extends BaseNode {
  kind: "FieldOfExpr";
  base: Expr;
  field: Ident;
}

export interface LeaExpr extends BaseNode {
  kind: "LeaExpr";
  base?: Expr;
  index?: Expr;
  scale?: number;
  disp?: number;
}

export interface TuplePattern extends BaseNode {
  kind: "TuplePattern";
  items: RegRefExpr[];
}

export interface Attribute extends BaseNode {
  kind: "Attribute";
  name: Ident;
  args: Expr[];
}

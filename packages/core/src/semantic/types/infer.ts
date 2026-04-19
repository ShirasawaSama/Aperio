import type { Expr, TypeExpr } from "@aperio/ast";

// Extremely small type inference subset for v1:
// infer literals only; everything else stays unknown.
export function inferExprType(expr: Expr): TypeExpr | undefined {
  if (expr.kind !== "LiteralExpr") {
    return undefined;
  }
  if (expr.literalKind === "int") {
    return makePrimType("i64", expr.span);
  }
  if (expr.literalKind === "float") {
    return makePrimType("f64", expr.span);
  }
  if (expr.literalKind === "bool") {
    return makePrimType("bool", expr.span);
  }
  return undefined;
}

function makePrimType(
  name: string,
  span: { fileId: number; start: number; end: number },
): TypeExpr {
  return {
    id: 0,
    kind: "TypeExpr",
    span,
    typeKind: "prim",
    name,
  };
}

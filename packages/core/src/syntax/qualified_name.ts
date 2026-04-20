/**
 * Split `alias::name` at the first `::` (import alias is the left segment).
 * Zero-dependency helper shared by lowering, semantic passes, and tooling.
 */
export function splitImportQualifiedCallee(text: string): { prefix: string; short: string } | undefined {
  const idx = text.indexOf("::");
  if (idx < 0) {
    return undefined;
  }
  const prefix = text.slice(0, idx);
  const short = text.slice(idx + 2);
  if (prefix.length === 0 || short.length === 0) {
    return undefined;
  }
  return { prefix, short };
}

const EXPLAIN: Record<string, string> = {
  E3001: "E3001: raw slot is used in a scope where an alias is active. Use the alias name.",
};

export async function runExplain(code: string): Promise<number> {
  const text = EXPLAIN[code] ?? `${code}: explanation not implemented yet`;
  process.stdout.write(`${text}\n`);
  return 0;
}

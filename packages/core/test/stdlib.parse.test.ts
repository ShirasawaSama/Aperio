import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const stdlibRoot = join(__dirname, "../../../stdlib");

function collectApFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectApFiles(full, acc);
    } else if (name.endsWith(".ap")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("stdlib .ap parse regression", () => {
  it("parses every .ap under /stdlib without diagnostics", () => {
    const paths = collectApFiles(stdlibRoot).sort();
    expect(paths.length).toBeGreaterThan(0);
    let fileId = 1;
    for (const abs of paths) {
      const src = readFileSync(abs, "utf8");
      const rel = relative(stdlibRoot, abs).replaceAll("\\", "/");
      const lexed = lex(fileId, src);
      expect(lexed.diagnostics, `lex ${rel}`).toEqual([]);
      const result = parseFile(rel, lexed.tokens);
      expect(result.diagnostics, `parse ${rel}: ${JSON.stringify(result.diagnostics)}`).toEqual([]);
      fileId += 1;
    }
  });
});

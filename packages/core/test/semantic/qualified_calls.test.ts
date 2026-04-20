import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expandBuiltinMacros, mergeCompilationUnit } from "@aperio/core";
import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { runSemantic } from "@aperio/semantic";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const stdlibRoot = join(__dirname, "../../../../stdlib");

function mergeFixture(absPath: string, src: string) {
  const lexed = lex(1, src);
  const parsed = parseFile(absPath, lexed.tokens);
  let nextLexId = 2;
  const merged = mergeCompilationUnit({
    entryPath: absPath,
    entryFile: parsed.file,
    entryNextNodeIdExclusive: parsed.nextNodeIdExclusive,
    stdlibRoot,
    readSource: (p) => {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return undefined;
      }
    },
    loadTokens: (_p, text) => {
      const lr = lex(nextLexId, text);
      nextLexId += 1;
      return { tokens: lr.tokens, diagnostics: lr.diagnostics };
    },
  });
  return { parsed, merged };
}

describe("checkQualifiedCalls", () => {
  it("accepts merged std/os/win calls after macro expand", () => {
    const fixture = resolve(__dirname, "../fixtures/hello.x86.ap");
    const src = readFileSync(fixture, "utf8");
    const { merged } = mergeFixture(fixture, src);
    expect(merged.diagnostics).toEqual([]);
    const expanded = expandBuiltinMacros(merged.file);
    const sem = runSemantic(expanded);
    expect(sem.diagnostics.filter((d) => d.code === "E5020")).toEqual([]);
  });

  it("reports E5020 for unknown qualified callee on import alias", () => {
    const fixture = resolve(__dirname, "../fixtures/bad_qualified.x86.ap");
    const src = readFileSync(fixture, "utf8");
    const { merged } = mergeFixture(fixture, src);
    expect(merged.diagnostics).toEqual([]);
    const expanded = expandBuiltinMacros(merged.file);
    const sem = runSemantic(expanded);
    expect(sem.diagnostics.some((d) => d.code === "E5020")).toBe(true);
  });
});

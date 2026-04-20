import { mergeCompilationUnit } from "@aperio/core";
import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const stdlibRoot = join(__dirname, "../../../stdlib");
const helloFixture = resolve(__dirname, "fixtures/hello.x86.ap");

describe("mergeCompilationUnit", () => {
  it("hoists std/os/win extern decls behind import", () => {
    const src = readFileSync(helloFixture, "utf8");
    const lexed = lex(1, src);
    expect(lexed.diagnostics).toEqual([]);
    const parsed = parseFile(helloFixture, lexed.tokens);
    expect(parsed.diagnostics).toEqual([]);

    let nextLexId = 2;
    const merged = mergeCompilationUnit({
      entryPath: helloFixture,
      entryFile: parsed.file,
      entryNextNodeIdExclusive: parsed.nextNodeIdExclusive,
      stdlibRoot,
      readSource: (abs) => {
        try {
          return readFileSync(abs, "utf8");
        } catch {
          return undefined;
        }
      },
      loadTokens: (_absPath, text) => {
        const lr = lex(nextLexId, text);
        nextLexId += 1;
        return { tokens: lr.tokens, diagnostics: lr.diagnostics };
      },
    });
    expect(merged.diagnostics).toEqual([]);
    const externs = merged.file.items.filter((i) => i.kind === "ExternFnDecl");
    expect(externs.length).toBeGreaterThanOrEqual(3);
    const names = new Set(externs.map((e) => (e.kind === "ExternFnDecl" ? e.name.text : "")));
    expect(names.has("get_std_handle")).toBe(true);
    expect(names.has("write_file")).toBe(true);
    expect(names.has("exit_process")).toBe(true);
  });
});

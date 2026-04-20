import type { Diagnostic } from "@aperio/diagnostics";
import { prepareProgramFromSource, SourceManager } from "@aperio/core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures");
const helloX86Path = resolve(fixturesDir, "hello.x86.ap");

function makeTestDiag(fileId: number, message: string): Diagnostic {
  return {
    code: "E7001",
    severity: "error",
    message,
    primary: {
      span: { fileId, start: 0, end: 0 },
      message,
    },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

describe.sequential("prepareProgramFromSource", () => {
  const cwdStack: string[] = [];
  afterEach(() => {
    while (cwdStack.length > 0) {
      const d = cwdStack.pop();
      if (d !== undefined) {
        process.chdir(d);
      }
    }
  });

  function pushChdir(dir: string): void {
    cwdStack.push(process.cwd());
    process.chdir(dir);
  }

  it("merges std imports and runs mid-end for native hello fixture", () => {
    const text = readFileSync(helloX86Path, "utf8");
    const sourceManager = new SourceManager();
    const entry = sourceManager.addFile(helloX86Path, text);
    const prep = prepareProgramFromSource({
      resolvedPath: helloX86Path,
      sourceText: text,
      entryFileId: entry.file.id,
      sourceManager,
      mode: "x86",
    });
    expect(prep.lexParseHadError).toBe(false);
    const externs = prep.expanded.items.filter((i) => i.kind === "ExternFnDecl");
    const names = new Set(externs.map((e) => (e.kind === "ExternFnDecl" ? e.name.text : "")));
    expect(names.has("get_std_handle")).toBe(true);
    expect(names.has("write_file")).toBe(true);
    expect(names.has("exit_process")).toBe(true);
  });

  it('uses modeFromPath when mode is "auto"', () => {
    const text = readFileSync(helloX86Path, "utf8");
    const sourceManager = new SourceManager();
    const entry = sourceManager.addFile(helloX86Path, text);
    const prep = prepareProgramFromSource({
      resolvedPath: helloX86Path,
      sourceText: text,
      entryFileId: entry.file.id,
      sourceManager,
      mode: "auto",
    });
    expect(prep.lexParseHadError).toBe(false);
    expect(prep.expanded.items.some((i) => i.kind === "ExternFnDecl")).toBe(true);
  });

  it("sets lexParseHadError when lex+parse contain an error", () => {
    const path = join(fixturesDir, "synthetic-broken.ap");
    const source = "@@@ not valid aperio @@@\n";
    const sourceManager = new SourceManager();
    const entry = sourceManager.addFile(path, source);
    const prep = prepareProgramFromSource({
      resolvedPath: path,
      sourceText: source,
      entryFileId: entry.file.id,
      sourceManager,
      mode: "std",
    });
    expect(prep.lexParseHadError).toBe(true);
    expect(prep.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("appends custom diagnostic when std/ import cannot resolve stdlib (build-style)", async () => {
    const root = await mkdtemp(join(tmpdir(), "aperio-prepare-no-stdlib-"));
    const mainPath = join(root, "main.ap");
    const body = `import "std/os/win" as os\npub fn main() -> (r0: i32) { r0 = 0 }\n`;
    await writeFile(mainPath, body, "utf8");
    pushChdir(root);
    const text = readFileSync(mainPath, "utf8");
    const sourceManager = new SourceManager();
    const entry = sourceManager.addFile(mainPath, text);
    const marker = "MISSING_STDLIB_TEST_MARKER";
    const prep = prepareProgramFromSource({
      resolvedPath: mainPath,
      sourceText: text,
      entryFileId: entry.file.id,
      sourceManager,
      mode: "std",
      missingStdlibBehavior: { diagnostic: makeTestDiag(entry.file.id, marker) },
    });
    expect(prep.diagnostics.some((d) => d.message === marker)).toBe(true);
  });

  it("does not append missing-stdlib diagnostic when behavior is silent (default)", async () => {
    const root = await mkdtemp(join(tmpdir(), "aperio-prepare-silent-stdlib-"));
    const mainPath = join(root, "main2.ap");
    const body = `import "std/os/win" as os\npub fn main() -> (r0: i32) { r0 = 0 }\n`;
    await writeFile(mainPath, body, "utf8");
    pushChdir(root);
    const text = readFileSync(mainPath, "utf8");
    const sourceManager = new SourceManager();
    const entry = sourceManager.addFile(mainPath, text);
    const marker = "SHOULD_NOT_APPEAR_SILENT_STDLIB";
    const prep = prepareProgramFromSource({
      resolvedPath: mainPath,
      sourceText: text,
      entryFileId: entry.file.id,
      sourceManager,
      mode: "std",
      missingStdlibBehavior: "silent",
    });
    expect(prep.diagnostics.some((d) => d.message === marker)).toBe(false);
  });

  it("merges relative imports without std/ (hoists non-fn symbols from dependency)", async () => {
    const root = await mkdtemp(join(tmpdir(), "aperio-prepare-rel-import-"));
    const depPath = join(root, "dep.x86.ap");
    const mainPath = join(root, "entry.x86.ap");
    await writeFile(depPath, "pub const K: i32 = 42\n", "utf8");
    await writeFile(
      mainPath,
      `import "./dep.x86.ap" as d\npub fn main() -> (r0: i32) { r0 = 0 }\n`,
      "utf8",
    );
    const text = readFileSync(mainPath, "utf8");
    const sourceManager = new SourceManager();
    const entry = sourceManager.addFile(mainPath, text);
    const prep = prepareProgramFromSource({
      resolvedPath: mainPath,
      sourceText: text,
      entryFileId: entry.file.id,
      sourceManager,
      mode: "x86",
    });
    expect(prep.lexParseHadError).toBe(false);
    const consts = prep.expanded.items.filter((i) => i.kind === "ConstDecl");
    expect(consts.some((c) => c.kind === "ConstDecl" && c.name.text === "K")).toBe(true);
    const mains = prep.expanded.items.filter((i) => i.kind === "FnDecl" && i.name.text === "main");
    expect(mains.length).toBe(1);
  });
});

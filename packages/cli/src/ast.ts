import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { printAst } from "@aperio/ast";
import { prepareProgramFromSource } from "@aperio/core";
import { modeFromPath } from "@aperio/mode";
import { SourceManager } from "@aperio/source";

/** Parse, merge imports when needed, run mid-end passes, then print JSON AST (matches build/check view). */
export async function runAst(file: string): Promise<number> {
  const text = await readFile(file, "utf8");
  const resolvedPath = resolve(file);
  const sourceManager = new SourceManager();
  const entry = sourceManager.addFile(resolvedPath, text);
  const prep = prepareProgramFromSource({
    resolvedPath,
    sourceText: text,
    entryFileId: entry.file.id,
    sourceManager,
    mode: modeFromPath(file),
  });

  if (prep.lexParseHadError) {
    process.stdout.write("[]\n");
    return 1;
  }

  process.stdout.write(`${printAst(prep.expanded)}\n`);

  const restErrors = prep.diagnostics.some((d) => d.severity === "error");
  return restErrors ? 1 : 0;
}

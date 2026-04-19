import { readFile } from "node:fs/promises";
import { printAst } from "@aperio/ast";
import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { SourceManager } from "@aperio/source";

export async function runAst(file: string): Promise<number> {
  const text = await readFile(file, "utf8");
  const sourceManager = new SourceManager();
  const source = sourceManager.addFile(file, text);
  const lexResult = lex(source.file.id, text);
  if (lexResult.diagnostics.length > 0) {
    process.stdout.write("[]\n");
    return 1;
  }
  const parseResult = parseFile(file, lexResult.tokens);
  process.stdout.write(`${printAst(parseResult.file)}\n`);
  return parseResult.diagnostics.length > 0 ? 1 : 0;
}

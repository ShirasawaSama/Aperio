import { readFile } from "node:fs/promises";
import path from "node:path";
import { lex } from "@aperio/lexer";
import { parseFile } from "@aperio/parser";
import { describe, expect, it } from "vitest";

interface DocBlock {
  idx: number;
  code: string;
}

const DOC_FILES = [
  "docs/std-strict/05_registers.md",
  "docs/std-strict/11_control_flow.md",
  "docs/std-strict/12_functions.md",
] as const;

// Some chapter examples are intentionally pseudo/invalid (for contrast teaching),
// or depend on features outside current parser surface. Keep them out of P0 parse baseline.
const BLOCK_SKIP: Record<string, Set<number>> = {
  "docs/std-strict/05_registers.md": new Set([3, 4, 5, 6, 9, 10, 14, 15]),
  "docs/std-strict/11_control_flow.md": new Set([5, 15, 16]),
  "docs/std-strict/12_functions.md": new Set([3, 4, 6, 11]),
};

describe("docs/std-strict parse baseline", () => {
  it("parses sampled rust code blocks from 05/11/12", async () => {
    const failures: string[] = [];
    const coverage: string[] = [];

    for (const rel of DOC_FILES) {
      const abs = path.resolve(process.cwd(), rel);
      const content = await readFile(abs, "utf8");
      const blocks = extractRustBlocks(content);
      let selected = 0;

      for (const block of blocks) {
        if (BLOCK_SKIP[rel]?.has(block.idx)) {
          continue;
        }
        if (!isParseCandidate(block.code)) {
          continue;
        }
        const source = normalizeToParseUnit(block.code);
        if (!source) {
          continue;
        }
        selected += 1;
        const tokens = lex(1, source).tokens;
        const parsed = parseFile(`${rel}#${block.idx}`, tokens);
        if (parsed.diagnostics.length > 0) {
          const codes = parsed.diagnostics.map((d) => d.code).join(",");
          failures.push(`${rel}#${block.idx} -> ${codes}`);
        }
      }

      coverage.push(`${rel}:${selected}`);
    }

    // Ensure each target chapter contributes at least one parse case.
    for (const item of coverage) {
      const [file, countRaw] = item.split(":");
      const count = Number.parseInt(countRaw ?? "0", 10);
      expect(count, `${file} should have sampled parse cases`).toBeGreaterThan(0);
    }

    expect(failures).toEqual([]);
  });
});

function extractRustBlocks(markdown: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let inRust = false;
  let current: string[] = [];
  let idx = 0;

  for (const line of lines) {
    if (!inRust) {
      if (line.trim().startsWith("```rust")) {
        inRust = true;
        current = [];
      }
      continue;
    }
    if (line.trim() === "```") {
      idx += 1;
      blocks.push({ idx, code: current.join("\n").trim() });
      inRust = false;
      current = [];
      continue;
    }
    current.push(line);
  }

  return blocks;
}

function isParseCandidate(code: string): boolean {
  if (!code) {
    return false;
  }
  if (/(非法|编译错|\.\.\.|TODO|todo)/.test(code)) {
    return false;
  }
  if (/^r\d+\s*$/m.test(code) || /^f\d+\s*$/m.test(code)) {
    return false;
  }
  return true;
}

function normalizeToParseUnit(code: string): string | undefined {
  const trimmed = code.trim();
  if (!trimmed) {
    return undefined;
  }

  const hasTopLevel = /\b(import|alias|const|val|var|type|struct|macro|extern\s+fn|pub\s+fn|fn)\b/.test(
    trimmed,
  );
  if (hasTopLevel) {
    return `${trimmed}\n`;
  }

  const hasStmtLike = /(^@)|\bgoto\b|\bif\b|\breturn\b|=/.test(trimmed);
  if (!hasStmtLike) {
    return undefined;
  }

  return `fn __doc_sample() -> (r0: i64) {\n${indent(trimmed)}\n  r0 = 0\n}\n`;
}

function indent(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}

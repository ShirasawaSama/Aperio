import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { Diagnostic, SourceMap } from "@aperio/diagnostics";
import {
  renderDiagnosticsHuman,
  renderDiagnosticsJson,
  renderDiagnosticsLsp,
} from "@aperio/diagnostics";
import { emitNativeWin64FromAst, emitNativeWin64MasmFromAst } from "@aperio/codegen/x86";
import { findStdlibRootNearEntry, mergeCompilationUnit, runMidendPipeline } from "@aperio/core";
import { lex } from "@aperio/lexer";
import { type AperioMode, modeFromPath } from "@aperio/mode";
import { parseFile } from "@aperio/parser";
import { SourceManager } from "@aperio/source";
import type { OutputFormat } from "./format_opt.js";

export interface BuildOptions {
  emit: "asm" | "obj" | "exe";
  format: OutputFormat;
  mode: "auto" | AperioMode;
  target: "win-x64";
  outDir?: string;
}

export async function runBuild(files: string[], options: BuildOptions): Promise<number> {
  const targets = files.length > 0 ? files : ["packages/core/test/fixtures/hello.x86.ap"];
  const sourceManager = new SourceManager();
  const diagnostics: Diagnostic[] = [];

  for (const path of targets) {
    const fileDiagStart = diagnostics.length;
    const text = await readFile(path, "utf8");
    const resolvedPath = resolve(path);
    const entry = sourceManager.addFile(resolvedPath, text);
    const lexResult = lex(entry.file.id, text);
    diagnostics.push(...lexResult.diagnostics);
    const parseResult = parseFile(resolvedPath, lexResult.tokens);
    diagnostics.push(...parseResult.diagnostics);

    const hasImport = parseResult.file.items.some((i) => i.kind === "ImportDecl");
    let programFile = parseResult.file;
    if (hasImport) {
      let stdlibRoot = findStdlibRootNearEntry(resolvedPath);
      if (!stdlibRoot) {
        const fallback = resolve(process.cwd(), "stdlib");
        if (existsSync(join(fallback, "std", "os", "win.ap"))) {
          stdlibRoot = fallback;
        }
      }
      if (!stdlibRoot) {
        diagnostics.push(
          makeBuildDiag(
            entry.file.id,
            "cannot resolve std/ imports: no stdlib directory found (expected …/stdlib/std/os/win.ap near the entry file or under cwd)",
          ),
        );
      } else {
        const merged = mergeCompilationUnit({
          entryPath: resolvedPath,
          entryFile: parseResult.file,
          entryNextNodeIdExclusive: parseResult.nextNodeIdExclusive,
          stdlibRoot,
          readSource: (abs) => {
            try {
              return readFileSync(abs, "utf8");
            } catch {
              return undefined;
            }
          },
          loadTokens: (absPath, src) => {
            const existing = sourceManager.getByPath(absPath);
            const mod = existing ?? sourceManager.addFile(absPath, src);
            return lex(mod.file.id, src);
          },
        });
        diagnostics.push(...merged.diagnostics);
        programFile = merged.file;
      }
    }

    const mode = options.mode === "auto" ? modeFromPath(path) : options.mode;
    const { expanded: macroExpandedFile, diagnostics: midendDiags } = runMidendPipeline(programFile, mode);
    diagnostics.push(...midendDiags);
    const fileDiags = diagnostics.slice(fileDiagStart);
    if (fileDiags.some((d) => d.severity === "error")) {
      continue;
    }

    if (options.target !== "win-x64") {
      diagnostics.push(makeBuildDiag(entry.file.id, `unsupported build target '${options.target}'`));
      continue;
    }

    const asm = emitNativeWin64FromAst(macroExpandedFile);
    const asmPath = buildOutputPath(path, "asm", options.outDir);
    await mkdir(dirname(asmPath), { recursive: true });
    await writeFile(asmPath, asm, "utf8");
    process.stdout.write(`wrote ${asmPath}\n`);

    if (options.emit === "asm") {
      continue;
    }

    const objPath = buildOutputPath(path, "obj", options.outDir);
    const asmResult = await runTool("clang", ["-c", asmPath, "-o", objPath]);
    const usedMsvcFallback = !asmResult.ok && isToolMissing(asmResult);
    if (usedMsvcFallback) {
      const masmResult = await assembleWithMsvc(path, macroExpandedFile, objPath, options.outDir);
      if (!masmResult.ok) {
        diagnostics.push(
          makeBuildDiag(
            entry.file.id,
            "failed to assemble source into .obj",
            [
              "tried clang and then ml64 fallback",
              "on Windows with Visual Studio, run this command from 'Developer PowerShell for VS'",
              ...masmResult.notes,
            ],
          ),
        );
        continue;
      }
    } else if (!asmResult.ok) {
      diagnostics.push(
        makeBuildDiag(
          entry.file.id,
          "failed to assemble .s into .obj",
          [
            "required tool: clang",
            "on Windows with Visual Studio, run this command from 'Developer PowerShell for VS'",
            ...asmResult.notes,
          ],
        ),
      );
      continue;
    }
    process.stdout.write(`wrote ${objPath}\n`);

    if (options.emit === "obj") {
      continue;
    }

    const exePath = buildOutputPath(path, "exe", options.outDir);
    const linkResult =
      usedMsvcFallback
        ? await linkWithMsvc(objPath, exePath)
        : await runTool("clang", [
            objPath,
            "-o",
            exePath,
            "-Wl,/subsystem:console",
            "-lkernel32",
          ]);
    if (!linkResult.ok) {
      diagnostics.push(
        makeBuildDiag(
          entry.file.id,
          "failed to link .obj into .exe",
          [
            usedMsvcFallback
              ? "tried link.exe fallback with Windows SDK libs"
              : "required tool: clang + windows linker runtime",
            "on Windows with Visual Studio, run this command from 'Developer PowerShell for VS'",
            ...linkResult.notes,
          ],
        ),
      );
      continue;
    }
    process.stdout.write(`wrote ${exePath}\n`);
  }

  const rendered = renderDiagnostics(
    diagnostics,
    options.format,
    sourceManagerToMap(sourceManager),
  );
  if (rendered.trim().length > 0) {
    process.stdout.write(`${rendered}\n`);
  }
  return diagnostics.some((d) => d.severity === "error") ? 1 : 0;
}

type BuildArtifact = "asm" | "obj" | "exe";

function buildOutputPath(inputPath: string, artifact: BuildArtifact, outDir?: string): string {
  const base = inputPath.slice(0, inputPath.length - extname(inputPath).length).replace(/\.x86$/i, "");
  const ext = artifact === "asm" ? ".s" : artifact === "obj" ? ".obj" : ".exe";
  const fileName = `${base.split(/[\\/]/).at(-1) ?? "out"}${ext}`;
  if (!outDir) {
    return `${base}${ext}`;
  }
  return join(outDir, fileName);
}

function renderDiagnostics(diags: Diagnostic[], format: OutputFormat, map: SourceMap): string {
  if (diags.length === 0) {
    return "";
  }
  switch (format) {
    case "json":
      return renderDiagnosticsJson(diags);
    case "lsp":
      return renderDiagnosticsLsp(diags, map);
    case "human":
    default:
      return renderDiagnosticsHuman(diags, map);
  }
}

function sourceManagerToMap(sourceManager: SourceManager): SourceMap {
  return {
    toSourceRange(targetSpan) {
      const entry = sourceManager.getById(targetSpan.fileId);
      if (!entry) {
        return {
          start: { fileId: targetSpan.fileId, line: 1, column: 1 },
          end: { fileId: targetSpan.fileId, line: 1, column: 1 },
        };
      }
      const start = entry.file.offsetToLineColumn(targetSpan.start);
      const end = entry.file.offsetToLineColumn(targetSpan.end);
      return {
        start: { fileId: targetSpan.fileId, line: start.line, column: start.column },
        end: { fileId: targetSpan.fileId, line: end.line, column: end.column },
      };
    },
  };
}

interface ToolRunResult {
  ok: boolean;
  notes: string[];
}

async function runTool(command: string, args: string[]): Promise<ToolRunResult> {
  return await new Promise<ToolRunResult>((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        notes: [String(error.message)],
      });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, notes: [] });
        return;
      }
      const notes = [stdout.trim(), stderr.trim()].filter((s) => s.length > 0);
      resolve({
        ok: false,
        notes: notes.length > 0 ? notes : [`${command} exited with code ${code}`],
      });
    });
  });
}

function isToolMissing(result: ToolRunResult): boolean {
  return result.notes.some((n) => n.includes("ENOENT"));
}

async function assembleWithMsvc(
  inputPath: string,
  file: import("@aperio/ast").FileUnit,
  objPath: string,
  outDir?: string,
): Promise<ToolRunResult> {
  const tools = detectMsvcTools();
  if (!tools) {
    return { ok: false, notes: ["unable to locate MSVC ml64/link tools"] };
  }
  const masmPath = buildOutputPath(inputPath, "asm", outDir).replace(/\.s$/i, ".asm");
  const masm = emitNativeWin64MasmFromAst(file);
  await mkdir(dirname(masmPath), { recursive: true });
  await writeFile(masmPath, masm, "utf8");
  process.stdout.write(`wrote ${masmPath}\n`);
  return await runTool(tools.ml64, ["/nologo", "/c", `/Fo${objPath}`, masmPath]);
}

async function linkWithMsvc(objPath: string, exePath: string): Promise<ToolRunResult> {
  const tools = detectMsvcTools();
  if (!tools) {
    return { ok: false, notes: ["unable to locate MSVC link toolchain"] };
  }
  return await runTool(tools.link, [
    "/nologo",
    "/SUBSYSTEM:CONSOLE",
    "/ENTRY:main",
    "/MACHINE:X64",
    `/OUT:${exePath}`,
    objPath,
    "kernel32.lib",
    `/LIBPATH:${tools.kernel32LibDir}`,
  ]);
}

interface MsvcTools {
  ml64: string;
  link: string;
  kernel32LibDir: string;
}

function detectMsvcTools(): MsvcTools | undefined {
  const msvcBase = "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC";
  if (!existsSync(msvcBase)) {
    return undefined;
  }
  const versions = safeVersionDirs(msvcBase);
  const latestMsvc = versions.at(-1);
  if (!latestMsvc) {
    return undefined;
  }
  const bin = join(msvcBase, latestMsvc, "bin", "Hostx64", "x64");
  const ml64 = join(bin, "ml64.exe");
  const linkExe = join(bin, "link.exe");
  if (!existsSync(ml64) || !existsSync(linkExe)) {
    return undefined;
  }

  const kitsLibBase = "C:\\Program Files (x86)\\Windows Kits\\10\\Lib";
  const sdkVersions = safeVersionDirs(kitsLibBase);
  const latestSdk = sdkVersions.at(-1);
  if (!latestSdk) {
    return undefined;
  }
  const kernel32LibDir = join(kitsLibBase, latestSdk, "um", "x64");
  if (!existsSync(join(kernel32LibDir, "kernel32.lib"))) {
    return undefined;
  }
  return { ml64, link: linkExe, kernel32LibDir };
}

function safeVersionDirs(path: string): string[] {
  if (!existsSync(path)) {
    return [];
  }
  return readdirSync(path, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+\.\d+/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => compareVersionStrings(a, b));
}

function compareVersionStrings(a: string, b: string): number {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10));
  const pb = b.split(".").map((x) => Number.parseInt(x, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) {
      return va - vb;
    }
  }
  return 0;
}

function makeBuildDiag(fileId: number, message: string, notes: string[] = []): Diagnostic {
  return {
    code: "E7001",
    severity: "error",
    message,
    primary: {
      span: { fileId, start: 0, end: 0 },
      message,
    },
    secondary: [],
    notes,
    fixes: [],
  };
}

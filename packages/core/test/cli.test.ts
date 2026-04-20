import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runAst, runBuild, runExplain } from "@aperio/cli";
import { describe, expect, it, vi } from "vitest";

describe("cli stubs", () => {
  it("ast prints merged mid-end FileUnit for native hello fixture", async () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      const fixture = resolve("packages/core/test/fixtures/hello.x86.ap");
      const code = await runAst(fixture);
      expect(code).toBe(0);
      const output = spy.mock.calls.map((c) => String(c[0])).join("");
      expect(output).toContain("ExternFnDecl");
      expect(output).toContain("exit_process");
    } finally {
      spy.mockRestore();
    }
  });

  it("prints explain output", async () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const code = await runExplain("E3001");
    expect(code).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("build emits win64 asm for native hello", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "aperio-build-"));
    try {
      const code = await runBuild(["packages/core/test/fixtures/hello.x86.ap"], {
        emit: "asm",
        format: "human",
        mode: "auto",
        target: "win-x64",
        outDir,
      });
      expect(code).toBe(0);
      const asmPath = join(outDir, "hello.s");
      const asm = await readFile(asmPath, "utf8");
      expect(asm).toContain(".intel_syntax noprefix");
      expect(asm).toContain(".section .rdata");
      expect(asm).toContain("MSG:");
      expect(asm).toContain("call GetStdHandle");
      expect(asm).toContain("call WriteFile");
      expect(asm).toContain("main:");
      expect(asm).toContain("call ExitProcess");
      expect(asm).toContain("ret");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("build emits exe (clang or MSVC fallback)", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "aperio-build-exe-"));
    try {
      const code = await runBuild(["packages/core/test/fixtures/hello.x86.ap"], {
        emit: "exe",
        format: "human",
        mode: "auto",
        target: "win-x64",
        outDir,
      });
      expect(code).toBe(0);
      const asmPath = join(outDir, "hello.s");
      const exePath = join(outDir, "hello.exe");
      await access(asmPath);
      await access(exePath);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("expands os macro aliases to winapi-shaped calls", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "aperio-build-macro-"));
    try {
      const code = await runBuild(["packages/core/test/fixtures/hello.macro.x86.ap"], {
        emit: "asm",
        format: "human",
        mode: "auto",
        target: "win-x64",
        outDir,
      });
      expect(code).toBe(0);
      const asmPath = join(outDir, "hello.macro.s");
      const asm = await readFile(asmPath, "utf8");
      expect(asm).toContain("call GetStdHandle");
      expect(asm).toContain("call WriteFile");
      expect(asm).toContain("call ExitProcess");
      expect(asm).not.toContain("__macro_write_stdout");
      expect(asm).not.toContain("unsupported os::write_stdout");
      expect(asm).not.toContain("unsupported os::exit");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

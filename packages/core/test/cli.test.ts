import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runBuild, runExplain } from "@aperio/cli";
import { describe, expect, it, vi } from "vitest";

describe("cli stubs", () => {
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
});

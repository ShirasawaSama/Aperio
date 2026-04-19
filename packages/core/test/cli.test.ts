import { runExplain } from "@aperio/cli";
import { describe, expect, it, vi } from "vitest";

describe("cli stubs", () => {
  it("prints explain output", async () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const code = await runExplain("E3001");
    expect(code).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

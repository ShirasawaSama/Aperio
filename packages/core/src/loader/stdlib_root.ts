import { existsSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

/** Walk parents of `entryPath` until `stdlib/std/os/win.ap` exists; return the `stdlib` directory. */
export function findStdlibRootNearEntry(entryPath: string): string | undefined {
  let dir = resolve(dirname(entryPath));
  for (;;) {
    const marker = join(dir, "stdlib", "std", "os", "win.ap");
    if (existsSync(marker)) {
      return join(dir, "stdlib");
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

export function resolveImportToAbsolutePath(input: {
  stdlibRoot: string;
  /** Absolute path to the `.ap` file that contains the `import`. */
  importerPath: string;
  /** Import path string from `import "…"`. */
  importPath: string;
}): string | undefined {
  const importerDir = dirname(resolve(input.importerPath));
  const p = input.importPath.replaceAll("\\", "/");
  if (p.startsWith("std/")) {
    return normalize(join(input.stdlibRoot, `${p}.ap`));
  }
  if (p.startsWith("./") || p.startsWith("../")) {
    const withExt = p.endsWith(".ap") ? p : `${p}.ap`;
    return normalize(join(importerDir, withExt));
  }
  return undefined;
}

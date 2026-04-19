import type { Diagnostic } from "@aperio/diagnostics";

export interface ImportResolveInput {
  importerPath: string;
  importPath: string;
}

export interface ImportResolveOutput {
  resolvedPath?: string;
  diagnostics: Diagnostic[];
}

// Import resolver stub with stable extension points.
// v1 supports std/* and relative paths only.
export function resolveImport(input: ImportResolveInput): ImportResolveOutput {
  const diagnostics: Diagnostic[] = [];
  if (input.importPath.startsWith("std/")) {
    return { resolvedPath: `std://${input.importPath}`, diagnostics };
  }
  if (input.importPath.startsWith("./") || input.importPath.startsWith("../")) {
    return { resolvedPath: `${input.importerPath}::${input.importPath}`, diagnostics };
  }
  if (input.importPath.startsWith("/")) {
    return { resolvedPath: `project-root://${input.importPath}`, diagnostics };
  }

  diagnostics.push({
    code: "E5003",
    severity: "error",
    message: `unknown package '${head(input.importPath)}'`,
    primary: {
      span: { fileId: 0, start: 0, end: 0 },
      message: "package not found in aperio.toml [deps]",
    },
    secondary: [],
    notes: ["package-manager integration is planned in src/pkg (E9xxx space)"],
    fixes: [],
  });
  return { diagnostics };
}

function head(path: string): string {
  const idx = path.indexOf("/");
  return idx === -1 ? path : path.slice(0, idx);
}

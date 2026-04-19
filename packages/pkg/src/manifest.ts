export interface PackageMeta {
  name: string;
  version: string;
  edition: string;
}

export interface DependencyRef {
  source: string;
  version: string;
  subdir?: string;
}

export interface AperioManifest {
  package: PackageMeta;
  deps: Record<string, DependencyRef>;
  build?: {
    target?: string;
    entrypoint?: string;
  };
}

// Manifest parser is intentionally deferred to v2.
export function parseManifest(_tomlText: string): AperioManifest {
  throw new Error("pkg manager not yet implemented; see ARCHITECTURE.md");
}

export interface LockPackage {
  name: string;
  source: string;
  version: string;
  commit: string;
  checksum: string;
  deps: string[];
}

export interface AperioLock {
  version: number;
  packages: LockPackage[];
}

export function parseLock(_text: string): AperioLock {
  throw new Error("pkg manager not yet implemented; see ARCHITECTURE.md");
}

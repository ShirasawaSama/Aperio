import type { AperioLock } from "./lock.js";
import type { AperioManifest } from "./manifest.js";

export interface ResolveOptions {
  locked?: boolean;
  offline?: boolean;
}

// MVS resolver contract.
// Full implementation is deferred; this API keeps higher layers stable.
export function resolveDependencies(
  _manifest: AperioManifest,
  _existingLock: AperioLock | undefined,
  _options: ResolveOptions,
): AperioLock {
  throw new Error("pkg manager not yet implemented; see ARCHITECTURE.md");
}

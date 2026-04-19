export interface FetchRequest {
  source: string;
  version: string;
}

export interface FetchResult {
  commit: string;
  cachePath: string;
  checksum: string;
}

// Fetcher contract for VCS-backed package retrieval.
// Real logic (git mirror/archive/checksum) will be added in v2.
export async function fetchPackage(_request: FetchRequest): Promise<FetchResult> {
  throw new Error("pkg manager not yet implemented; see ARCHITECTURE.md");
}

import { SourceFile } from "./source_file.js";

export interface PackageSourceInfo {
  name: string;
  version: string;
  commit: string;
}

export interface FileEntry {
  file: SourceFile;
  // Reserved for package-manager integration (E9xxx).
  pkgSource?: PackageSourceInfo;
}

// SourceManager owns file ids and path->file canonicalization.
export class SourceManager {
  private nextId = 1;
  private readonly byId = new Map<number, FileEntry>();
  private readonly pathToId = new Map<string, number>();

  public addFile(path: string, text: string, pkgSource?: PackageSourceInfo): FileEntry {
    const existingId = this.pathToId.get(path);
    if (existingId !== undefined) {
      const existing = this.byId.get(existingId);
      if (existing !== undefined) {
        return existing;
      }
    }

    const file = new SourceFile(this.nextId, path, text);
    const entry: FileEntry = { file, pkgSource };
    this.byId.set(file.id, entry);
    this.pathToId.set(path, file.id);
    this.nextId += 1;
    return entry;
  }

  public getById(id: number): FileEntry | undefined {
    return this.byId.get(id);
  }

  public getByPath(path: string): FileEntry | undefined {
    const id = this.pathToId.get(path);
    return id === undefined ? undefined : this.byId.get(id);
  }
}

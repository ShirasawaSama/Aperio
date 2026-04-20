import type { FileUnit } from "@aperio/ast";
import type { LoweringState } from "./context.js";

export function maxNodeId(file: FileUnit): number {
  let max = file.id;
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    const maybeNode = value as { id?: number; [k: string]: unknown };
    if (typeof maybeNode.id === "number" && maybeNode.id > max) {
      max = maybeNode.id;
    }
    for (const child of Object.values(maybeNode)) {
      visit(child);
    }
  };
  visit(file);
  return max;
}

export function nextId(state: LoweringState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

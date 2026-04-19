import type { Diagnostic } from "@aperio/diagnostics";
import type { RegTypeMap } from "./reg_flow.js";

// Merge two register type snapshots.
// Mismatch emits E4001 and keeps the left type to continue analysis.
export function mergeRegTypes(
  left: RegTypeMap,
  right: RegTypeMap,
): { merged: RegTypeMap; diagnostics: Diagnostic[] } {
  const merged: RegTypeMap = new Map(left);
  const diagnostics: Diagnostic[] = [];
  for (const [slot, rType] of right) {
    const lType = merged.get(slot);
    if (!lType) {
      merged.set(slot, rType);
      continue;
    }
    if (lType !== rType) {
      diagnostics.push({
        code: "E4001",
        severity: "error",
        message: `register '${slot}' type mismatch at merge point`,
        primary: { span: { fileId: 0, start: 0, end: 0 }, message: `${lType} vs ${rType}` },
        secondary: [],
        notes: ["v1 uses synthetic span; CFG-aware spans come in v2"],
        fixes: [],
      });
    }
  }
  return { merged, diagnostics };
}

import type { FileUnit, SlotBinding } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

export type RegTypeMap = Map<string, string>;

// v1 seed rule:
// build initial register type map from signature-level slots.
export function buildInitialRegTypes(file: FileUnit): Map<number, RegTypeMap> {
  const result = new Map<number, RegTypeMap>();
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    const map: RegTypeMap = new Map();
    for (const binding of [...item.params, ...item.returns]) {
      putBindingType(map, binding);
    }
    result.set(item.id, map);
  }
  return result;
}

export function checkUnknownRegWrites(_file: FileUnit): Diagnostic[] {
  // TODO(v2): detect writes to undeclared caller-saved slots and emit E4003.
  return [];
}

function putBindingType(map: RegTypeMap, binding: SlotBinding): void {
  if (binding.type) {
    map.set(binding.slot.name, binding.type.name);
  }
}

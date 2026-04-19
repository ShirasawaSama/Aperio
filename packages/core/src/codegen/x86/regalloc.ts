import type { IrInstruction } from "@aperio/ir";

export interface RegAllocResult {
  instructions: IrInstruction[];
  mapping: Map<string, string>;
}

// Register allocation stub.
// v2 algorithm note: linear-scan over live intervals, spill to stack on pressure.
export function allocateRegisters(instructions: IrInstruction[]): RegAllocResult {
  return {
    instructions,
    mapping: new Map(),
  };
}

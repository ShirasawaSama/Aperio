import type { IrFunction, IrInstruction } from "@aperio/ir";

// Instruction selection stub.
// v2 algorithm note: use DAG/tree pattern matching to lower IR ops to x86 forms.
export function selectInstructions(fn: IrFunction): IrInstruction[] {
  return fn.instructions.map((ins) => ({
    ...ins,
    comment: ins.comment ?? "isel stub: direct pass-through",
  }));
}

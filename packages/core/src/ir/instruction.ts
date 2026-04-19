// IR is intentionally target-neutral and close to Std-Strict semantics.
export interface IrInstruction {
  op: string;
  args: string[];
  result?: string;
  comment?: string;
}

import type { IrInstruction } from "@aperio/ir";

// Emits textual x86 assembly skeleton.
export function emitX86(instructions: IrInstruction[]): string {
  const body = instructions.map((ins) => `  ; ${ins.op} ${ins.args.join(", ")}`).join("\n");
  return [".text", "  ; x86 emit stub", body].filter(Boolean).join("\n");
}

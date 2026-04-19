import type { IrInstruction } from "./instruction.js";

export interface IrFunction {
  name: string;
  instructions: IrInstruction[];
}

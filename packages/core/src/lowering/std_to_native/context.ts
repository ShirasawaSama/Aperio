import type { FileUnit, Stmt } from "@aperio/ast";
import type { LoweringResult } from "../types.js";

export interface LoweringState {
  nextId: number;
}

export interface LoweringEnv {
  diagnostics: LoweringResult<FileUnit>["diagnostics"];
  state: LoweringState;
  reservedLabels: Set<string>;
  reservedRegs: Set<string>;
}

export type LowerStmtList = (stmts: Stmt[], env: LoweringEnv) => Stmt[];

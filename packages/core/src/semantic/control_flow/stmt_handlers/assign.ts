import type { AssignStmt } from "@aperio/ast";
import { inferTypeName } from "../state_flow.js";
import type { TypeState } from "../types.js";

export function handleAssignStmt(stmt: AssignStmt, state: TypeState): boolean {
  const inferred = inferTypeName(stmt.value, state);
  if (inferred) {
    state.set(stmt.target.name, inferred);
  } else {
    state.delete(stmt.target.name);
  }
  return true;
}

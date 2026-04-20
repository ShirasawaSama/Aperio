import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { resolveAliases } from "./aliases/index.js";
import { checkQualifiedCalls } from "./calls/index.js";
import { checkControlFlow } from "./control_flow/index.js";
import { buildInitialRegTypes, checkUnknownRegWrites } from "./dreg/index.js";
import { checkTypes } from "./types/index.js";

export interface SemanticPassResult {
  diagnostics: Diagnostic[];
}

// Semantic pipeline entry for v1 skeleton.
// Pass order intentionally mirrors long-term architecture:
// aliases -> qualified import callees -> types -> control flow -> dreg.
export function runSemantic(file: FileUnit): SemanticPassResult {
  const diagnostics: Diagnostic[] = [];

  const aliasResult = resolveAliases(file);
  diagnostics.push(...aliasResult.diagnostics);

  diagnostics.push(...checkQualifiedCalls(file));

  diagnostics.push(...checkTypes(file));
  diagnostics.push(...checkControlFlow(file));

  // Force execution so the API is exercised in tests.
  buildInitialRegTypes(file);
  diagnostics.push(...checkUnknownRegWrites(file));

  return { diagnostics };
}

export { SemanticContext } from "./context.js";
export { checkQualifiedCalls, splitImportQualifiedCallee } from "./calls/index.js";

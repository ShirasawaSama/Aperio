import type { FileUnit, FnDecl, Item } from "@aperio/ast";
import { collectLabelNames, collectUsedRegNamesForFn } from "./collect.js";
import type { LoweringState } from "./context.js";
import { maxNodeId } from "./ids.js";
import { lowerStmtList } from "./lower_stmt.js";
import type { LoweringContext, LoweringResult } from "../types.js";

export function lowerStdToNativeAst(context: LoweringContext): LoweringResult<FileUnit> {
  const state: LoweringState = {
    nextId: maxNodeId(context.source) + 1,
  };
  const diagnostics: LoweringResult<FileUnit>["diagnostics"] = [];
  const items: Item[] = context.source.items.map((item) => {
    if (item.kind !== "FnDecl") {
      return item;
    }
    const reserved = new Set<string>();
    const reservedRegs = collectUsedRegNamesForFn(item);
    collectLabelNames(item.body, reserved);
    const body = lowerStmtList(item.body, {
      diagnostics,
      state,
      reservedLabels: reserved,
      reservedRegs,
    });
    const loweredFn: FnDecl = {
      ...item,
      body,
    };
    return loweredFn;
  });

  return {
    output: {
      ...context.source,
      items,
    },
    diagnostics,
  };
}

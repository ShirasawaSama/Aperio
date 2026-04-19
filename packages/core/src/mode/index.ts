import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";
import { guardLoose } from "./loose.js";
import { guardNativeStrictX86 } from "./native_strict_x86.js";
import { guardStdStrict } from "./std_strict.js";

export type AperioMode = "std" | "x86" | "loose";

export function modeFromPath(path: string): AperioMode {
  if (path.endsWith(".x86.ap")) {
    return "x86";
  }
  if (path.endsWith(".apo")) {
    return "loose";
  }
  return "std";
}

export function guardMode(file: FileUnit, mode: AperioMode): Diagnostic[] {
  switch (mode) {
    case "x86":
      return guardNativeStrictX86(file);
    case "loose":
      return guardLoose(file);
    case "std":
    default:
      return guardStdStrict(file);
  }
}

export { guardLoose, guardNativeStrictX86, guardStdStrict };

import type { FileUnit } from "@aperio/ast";
import type { Diagnostic } from "@aperio/diagnostics";

// Native-strict x86 subset checker (v1):
// enforce slot count constraints and reserve non-usable stack pointer slot.
export function guardNativeStrictX86(file: FileUnit): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const item of file.items) {
    if (item.kind !== "FnDecl") {
      continue;
    }
    const slots = [...item.params, ...item.returns, ...item.uses].map((b) => b.slot.name);
    for (const slot of slots) {
      if (slot.startsWith("r")) {
        const n = Number(slot.slice(1));
        if (!Number.isFinite(n) || n < 0 || n > 15) {
          diagnostics.push(
            diag(item.span, "E6002", `native-x86 allows only r0..r15, got '${slot}'`),
          );
        }
        if (n === 4) {
          diagnostics.push(
            diag(item.span, "E6003", "r4 (rsp) is reserved and cannot be user-assigned"),
          );
        }
      }
      if (slot.startsWith("f")) {
        const n = Number(slot.slice(1));
        if (!Number.isFinite(n) || n < 0 || n > 15) {
          diagnostics.push(
            diag(item.span, "E6004", `native-x86 allows only f0..f15, got '${slot}'`),
          );
        }
      }
    }
  }
  return diagnostics;
}

function diag(
  span: { fileId: number; start: number; end: number },
  code: string,
  message: string,
): Diagnostic {
  return {
    code,
    severity: "error",
    message,
    primary: { span, message },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

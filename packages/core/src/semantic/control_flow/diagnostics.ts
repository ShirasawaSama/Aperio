import type { Diagnostic, Span } from "@aperio/diagnostics";

export function diagGotoIntoInner(labelName: string, targetSpan: Span): Diagnostic {
  return {
    code: "E4010",
    severity: "error",
    message: `goto cannot jump into inner block label '${labelName}'`,
    primary: { span: targetSpan, message: "target label is inside a nested block" },
    secondary: [],
    notes: ["goto can only jump to labels in the same or outer block"],
    fixes: [],
  };
}

export function diagLabelArityMismatch(labelName: string, expected: number, got: number, span: Span): Diagnostic {
  return {
    code: "E4011",
    severity: "error",
    message: `label '${labelName}' expects ${expected} argument(s), got ${got}`,
    primary: { span, message: "label parameter arity mismatch" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

export function diagLabelArgTypeMismatch(
  labelName: string,
  expected: string,
  actual: string,
  argSpan: Span,
): Diagnostic {
  return {
    code: "E4012",
    severity: "error",
    message: `label argument type mismatch for '${labelName}'`,
    primary: { span: argSpan, message: `expected ${expected}, got ${actual}` },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

export function diagUnknownCallArg(argName: string, span: Span): Diagnostic {
  return {
    code: "E4013",
    severity: "error",
    message: `unknown call argument slot '${argName}'`,
    primary: { span, message: "argument name does not match function signature" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

export function diagPositionalExprNeedsTarget(span: Span): Diagnostic {
  return {
    code: "E4014",
    severity: "error",
    message: "call expression argument must specify explicit slot target",
    primary: { span, message: "write this as '<slot> = <expr>'" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

export function diagTooManyPositionalArgs(span: Span): Diagnostic {
  return {
    code: "E4015",
    severity: "error",
    message: "too many positional register arguments",
    primary: { span, message: "no remaining parameter slot in callee signature" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

export function diagPositionalSlotMismatch(expectedSlot: string, valueSpan: Span): Diagnostic {
  return {
    code: "E4016",
    severity: "error",
    message: `positional argument must use matching slot '${expectedSlot}'`,
    primary: { span: valueSpan, message: "use named syntax if slot is different (e.g. r1 = ...)" },
    secondary: [],
    notes: [],
    fixes: [],
  };
}

export function diagBranchMergeTypeMismatch(
  slot: string,
  thenType: string,
  elseType: string,
  span: Span,
): Diagnostic {
  return {
    code: "E4017",
    severity: "error",
    message: `branch merge type mismatch on '${slot}'`,
    primary: {
      span,
      message: `then branch is ${thenType}, else branch is ${elseType}`,
    },
    secondary: [],
    notes: ["assign the same logical type on both branches, or cast explicitly before merge"],
    fixes: [],
  };
}

export function diagIncomingParamTypeMismatch(
  labelName: string,
  index: number,
  currentType: string,
  previousType: string,
  currentSpan: Span,
  previousSpan: Span,
): Diagnostic {
  return {
    code: "E4018",
    severity: "error",
    message: `inconsistent incoming type for label '${labelName}' parameter #${index + 1}`,
    primary: {
      span: currentSpan,
      message: `this edge passes ${currentType}, previous edge passed ${previousType}`,
    },
    secondary: [{ span: previousSpan, message: `previous incoming type: ${previousType}` }],
    notes: ["all incoming edges to the same label parameter should agree on logical type"],
    fixes: [],
  };
}

export function diagIncomingStateTypeMismatch(
  labelName: string,
  slot: string,
  edgeKind: string,
  currentType: string,
  previousType: string,
  currentSpan: Span,
  previousSpan: Span,
): Diagnostic {
  return {
    code: "E4019",
    severity: "error",
    message: `inconsistent incoming state type for label '${labelName}' slot '${slot}'`,
    primary: {
      span: currentSpan,
      message: `edge '${edgeKind}' has ${currentType}, previous edge has ${previousType}`,
    },
    secondary: [{ span: previousSpan, message: `previous incoming type: ${previousType}` }],
    notes: ["ensure all incoming edges agree on non-parameter register logical types"],
    fixes: [],
  };
}

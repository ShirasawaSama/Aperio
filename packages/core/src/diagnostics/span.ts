// Span is an absolute byte range inside one source file.
// Offsets are UTF-16 code unit indices to match JS string slicing behavior.
export interface Span {
  fileId: number;
  start: number;
  end: number;
}

// Helper constructor used by parser/lexer to keep call sites terse.
export function span(fileId: number, start: number, end: number): Span {
  return { fileId, start, end };
}

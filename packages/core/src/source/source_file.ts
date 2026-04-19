// SourceFile stores immutable source text plus a precomputed line table.
// Line table enables O(log n) offset->(line,column) mapping.
export class SourceFile {
  public readonly lineStarts: number[];

  public constructor(
    public readonly id: number,
    public readonly path: string,
    public readonly text: string,
  ) {
    this.lineStarts = computeLineStarts(text);
  }

  public offsetToLineColumn(offset: number): { line: number; column: number } {
    const safeOffset = Math.max(0, Math.min(offset, this.text.length));
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const start = this.lineStarts[mid];
      const next =
        mid + 1 < this.lineStarts.length ? this.lineStarts[mid + 1] : Number.MAX_SAFE_INTEGER;
      if (safeOffset < start) {
        hi = mid - 1;
      } else if (safeOffset >= next) {
        lo = mid + 1;
      } else {
        return { line: mid + 1, column: safeOffset - start + 1 };
      }
    }
    return { line: 1, column: 1 };
  }
}

function computeLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

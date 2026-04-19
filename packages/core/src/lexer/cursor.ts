export class LexerCursor {
  public index = 0;

  public constructor(
    public readonly fileId: number,
    public readonly source: string,
  ) {}

  public current(): string | undefined {
    return this.source[this.index];
  }

  public peek(offset = 1): string | undefined {
    return this.source[this.index + offset];
  }

  public eof(): boolean {
    return this.index >= this.source.length;
  }

  public advance(step = 1): void {
    this.index += step;
  }
}

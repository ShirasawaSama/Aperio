export function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

export function isIdentContinue(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

export function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}

export function isSymbol(ch: string): boolean {
  return "(){}[],:=+-*/@.&<>!#".includes(ch);
}

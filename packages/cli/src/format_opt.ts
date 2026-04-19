export type OutputFormat = "human" | "json" | "lsp";

export function parseOutputFormat(value: string | undefined): OutputFormat {
  if (value === "json" || value === "lsp") {
    return value;
  }
  return "human";
}

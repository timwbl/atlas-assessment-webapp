export function formatBlockLabel(block: string): string {
  const value = String(block || "").trim();
  if (!value) return "Block";
  return /^block\b/i.test(value) ? value.replace(/^block\b/i, "Block") : `Block ${value}`;
}

export function formatBlockLabel(block: string): string {
  const value = String(block || "").trim();
  if (!value) return "Block";
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");
  const yearTwoMatch = normalized.match(/\bj2\s*block\s*([1-6])\b/)
    || normalized.match(/\byear\s*2\s*block\s*([1-6])\b/);
  if (yearTwoMatch) return `Block ${yearTwoMatch[1]}`;
  return /^block\b/i.test(value) ? value.replace(/^block\b/i, "Block") : `Block ${value}`;
}

export function blockColor(block: string): string {
  const value = String(block || "").trim().toLowerCase();
  const number = value.match(/\d+/)?.[0] || "";

  const colors: Record<string, string> = {
    "5": "#22c55e",
    "6": "#14b8a6",
    "7": "#06b6d4",
    "8": "#3b82f6",
    "9": "#4f46e5"
  };

  return colors[number] || "#0a84ff";
}

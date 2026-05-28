export function blockColor(block: string): string {
  const value = String(block || "").trim().toLowerCase();
  const number = value.match(/\d+/)?.[0] || "";

  const colors: Record<string, string> = {
    "1": "#b8004f",
    "2": "#d81717",
    "3": "#f45a00",
    "4": "#ff9f0a",
    "5": "#22c55e",
    "6": "#14b8a6",
    "7": "#06b6d4",
    "8": "#3b82f6",
    "9": "#4f46e5",
    "prüfungssimulationen": "#1d1d1f",
    "pruefungssimulationen": "#1d1d1f"
  };

  return colors[number] || colors[value] || "#0a84ff";
}

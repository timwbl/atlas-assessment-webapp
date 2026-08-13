export function blockColor(block: string): string {
  const value = String(block || "").trim().toLowerCase();
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");
  const j2Match = normalized.match(/\bj2\s*block\s*([1-6])\b/)
    || normalized.match(/\byear\s*2\s*block\s*([1-6])\b/)
    || value.match(/\bj2-block([1-6])\b/);
  if (j2Match) {
    const yearTwoColors: Record<string, string> = {
      "1": "#c91f1f",
      "2": "#f35b04",
      "3": "#ff9f0a",
      "4": "#1f7a35",
      "5": "#006b5f",
      "6": "#008a96"
    };
    return yearTwoColors[j2Match[1]] || "#0a84ff";
  }

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
    "altfragen": "#8e8e93",
    "prüfungssimulationen": "#1d1d1f",
    "pruefungssimulationen": "#1d1d1f"
  };

  return colors[number] || colors[value] || "#0a84ff";
}

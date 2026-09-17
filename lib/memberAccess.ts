export const MEMBER_SESSION_COOKIE = "atlas-member-session";

export function hasPriorityAccess(profile: { role?: string; close_circle?: boolean } | null | undefined): boolean {
  return profile?.role === "admin" || profile?.close_circle === true;
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  const path = value.split(/[?#]/)[0];
  return path === "/maintenance" || path.startsWith("/maintenance/") ? "/" : value;
}

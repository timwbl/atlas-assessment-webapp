"use client";

import { APP_VERSION } from "./appVersion";

const RECOVERY_KEY = `atlas:chunk-recovery:${APP_VERSION}`;
const RECOVERY_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const record = error && typeof error === "object" ? error as { name?: string; message?: string } : null;
  const message = typeof error === "string"
    ? error
    : `${record?.name || ""} ${record?.message || ""}`;
  return /ChunkLoadError|Loading chunk [\d-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

export async function recoverFromChunkLoadError(error: unknown): Promise<boolean> {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;

  const previous = Number(window.sessionStorage.getItem(RECOVERY_KEY) || 0);
  if (Number.isFinite(previous) && Date.now() - previous < RECOVERY_WINDOW_MS) return false;
  window.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));

  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("atlas-mobile-")).map((key) => window.caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("atlas-refresh", APP_VERSION);
    window.location.replace(url.toString());
  }
  return true;
}

export function clearChunkRecoveryGuard(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RECOVERY_KEY);
}

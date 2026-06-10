"use client";

import { useEffect } from "react";
import {
  clearChunkRecoveryGuard,
  isChunkLoadError,
  recoverFromChunkLoadError
} from "@/lib/clientChunkRecovery";

export function ChunkRecovery() {
  useEffect(() => {
    const clearTimer = window.setTimeout(clearChunkRecoveryGuard, 15_000);
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error || event.message)) {
        event.preventDefault();
        void recoverFromChunkLoadError(event.error || event.message);
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        void recoverFromChunkLoadError(event.reason);
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.clearTimeout(clearTimer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

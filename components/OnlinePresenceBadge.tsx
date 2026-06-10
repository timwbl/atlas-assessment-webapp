"use client";

import { useEffect, useState } from "react";
import { heartbeatPresence } from "@/lib/onlinePresence";

export function OnlinePresenceBadge() {
  const [count, setCount] = useState(1);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let heartbeat: number | null = null;

    async function update() {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await heartbeatPresence();
        if (!cancelled) {
          setCount(next);
          setAvailable(true);
        }
      } catch {
        if (!cancelled) {
          setAvailable(false);
          setCount(1);
        }
      }
    }

    function start() {
      if (heartbeat !== null) window.clearInterval(heartbeat);
      void update();
      heartbeat = window.setInterval(update, 30_000);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") start();
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (heartbeat !== null) window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div className="online-presence-badge" title={available ? "Aktive Verbindungen zur WebApp" : "Online-Zähler lokal"}>
      <span className={available ? "online-presence-dot" : "online-presence-dot is-muted"} />
      <strong>{count}</strong>
      <span>{count === 1 ? "Person online" : "Personen online"}</span>
    </div>
  );
}

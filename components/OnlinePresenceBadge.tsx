"use client";

import { useEffect, useState } from "react";
import { countOnlinePresence, heartbeatPresence } from "@/lib/onlinePresence";

export function OnlinePresenceBadge() {
  const [count, setCount] = useState(1);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function update() {
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

    void update();
    const heartbeat = window.setInterval(update, 25_000);
    const refreshCount = window.setInterval(() => {
      void countOnlinePresence()
        .then((next) => {
          if (!cancelled) setCount(next);
        })
        .catch(() => {
          if (!cancelled) setAvailable(false);
        });
    }, 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.clearInterval(refreshCount);
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

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AdminShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "a") {
        router.push("/admin");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <button
      aria-label="Admin"
      className="fixed bottom-3 right-3 h-3 w-3 rounded-full border-0 bg-transparent opacity-20"
      onDoubleClick={() => router.push("/admin")}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import { syncMemberSession, type MemberStatus } from "@/lib/memberSession";
import Image from "next/image";
import Link from "next/link";

export function AtlasBrand({ inline = false }: { inline?: boolean }) {
  const [member, setMember] = useState<MemberStatus | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      const status = await syncMemberSession().catch(() => null);
      if (active && current === generation) setMember(status);
    }
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
    window.addEventListener("atlas-membership-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
      window.removeEventListener("atlas-membership-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <Link
      aria-label="ATLAS Startseite"
      className={`atlas-brand${inline ? " atlas-brand--inline" : ""}`}
      href="/"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="atlas-brand-logo"
        height={31}
        src="/atlas-logo.svg"
        width={31}
      />
      <span className="atlas-brand-copy"><span className="atlas-brand-word">ATLAS</span>
        {member?.role === "admin" ? <span className="atlas-member-badge atlas-member-badge--admin">ADMIN</span>
          : member?.closeCircle ? <span className="atlas-member-badge atlas-member-badge--circle">Close-Circle</span> : null}
      </span>
    </Link>
  );
}

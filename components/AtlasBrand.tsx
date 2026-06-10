import Image from "next/image";
import Link from "next/link";

export function AtlasBrand() {
  return (
    <Link
      aria-label="ATLAS Startseite"
      className="atlas-brand"
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
      <span className="atlas-brand-word">ATLAS</span>
    </Link>
  );
}

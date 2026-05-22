import Link from "next/link";

export function AtlasBrand() {
  return (
    <Link
      aria-label="ATLAS Startseite"
      className="atlas-brand"
      href="/"
    >
      <img
        alt=""
        aria-hidden="true"
        className="atlas-brand-logo"
        src="/atlas-logo.svg"
      />
      <span className="atlas-brand-word">ATLAS</span>
    </Link>
  );
}

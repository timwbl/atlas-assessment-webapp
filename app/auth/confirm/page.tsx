import type { Metadata } from "next";
import { EmailConfirmationClient } from "@/components/EmailConfirmationClient";

export const metadata: Metadata = {
  title: "E-Mail bestätigen · ATLAS",
  description: "Bestätige deine E-Mail-Adresse für deinen ATLAS Account."
};

export default function EmailConfirmationPage() {
  return <EmailConfirmationClient />;
}

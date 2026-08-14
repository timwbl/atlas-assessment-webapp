import type { Metadata } from "next";
import { OAuthCallbackClient } from "@/components/OAuthCallbackClient";

export const metadata: Metadata = {
  title: "Anmeldung abschliessen · ATLAS",
  description: "Schliesse die Anmeldung über Google für deinen ATLAS Account ab."
};

export default function OAuthCallbackPage() {
  return <OAuthCallbackClient />;
}

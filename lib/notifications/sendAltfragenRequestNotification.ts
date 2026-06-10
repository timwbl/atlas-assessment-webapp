import {
  renderAltfragenRequestNotification,
  type AltfragenNotificationData
} from "../email/templates/altfragenRequestNotification";
import { sendEmail } from "../email/sendEmail";

export async function sendAltfragenRequestNotification(
  request: Omit<AltfragenNotificationData, "adminUrl">
): Promise<void> {
  const adminEmail = process.env.ATLAS_ADMIN_EMAIL?.trim() || "";
  if (!adminEmail) throw new Error("ATLAS_ADMIN_EMAIL ist nicht konfiguriert.");

  const appUrl = configuredAppUrl();
  const adminUrl = `${appUrl}/admin#altfragen-request-${encodeURIComponent(request.id)}`;
  const email = renderAltfragenRequestNotification({ ...request, adminUrl });
  await sendEmail({
    to: adminEmail,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}

function configuredAppUrl(): string {
  const configured = process.env.ATLAS_APP_URL?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || "";
  if (!configured) throw new Error("ATLAS_APP_URL ist nicht konfiguriert.");
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("ATLAS_APP_URL muss eine HTTP(S)-URL sein.");
  }
  return url.origin.replace(/\/$/, "");
}

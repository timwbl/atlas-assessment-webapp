export type AltfragenNotificationData = {
  id: string;
  displayName?: string | null;
  userEmail?: string | null;
  studyYear?: number | null;
  semester?: string | null;
  examOrBlock?: string | null;
  message?: string | null;
  fileNames?: string[];
  createdAt: string;
  adminUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderAltfragenRequestNotification(data: AltfragenNotificationData): RenderedEmail {
  const fields = [
    ["Name", display(data.displayName)],
    ["E-Mail", display(data.userEmail)],
    ["Studienjahr", data.studyYear ? `${data.studyYear}. Studienjahr` : "Nicht angegeben"],
    ["Semester", display(data.semester)],
    ["Prüfung / Block", display(data.examOrBlock)],
    ["Zeitpunkt", formatDate(data.createdAt)],
    ["Request-ID", display(data.id)]
  ];
  const files = data.fileNames?.filter(Boolean) || [];
  if (files.length) fields.splice(5, 0, ["Dateien", `${files.length} Datei${files.length === 1 ? "" : "en"}`]);

  const rows = fields.map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;color:#6b7280;font-size:13px;vertical-align:top;width:38%;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#17191f;font-size:14px;font-weight:700;vertical-align:top;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
    </tr>
  `).join("");
  const description = display(data.message);
  const safeAdminUrl = escapeHtml(data.adminUrl);

  return {
    subject: `Neue Altfragen-Anfrage · ${subjectText(data.displayName)}`,
    html: `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Neue Altfragen-Anfrage</title>
  </head>
  <body style="margin:0;background:#eef2f7;color:#17191f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">Eine neue ATLAS Altfragen-Anfrage wartet auf Bearbeitung.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;">
            <tr>
              <td style="padding:0 4px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="color:#111827;font-size:22px;font-weight:900;letter-spacing:.08em;">ATLAS</td>
                    <td align="right" style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Admin Notification</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #dce3ec;border-radius:24px;background:#ffffff;padding:34px;box-shadow:0 18px 50px rgba(15,23,42,.08);">
                <div style="color:#2563eb;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Altfragen Zugriff</div>
                <h1 style="margin:10px 0 0;color:#111318;font-size:30px;line-height:1.12;">Neue Altfragen-Anfrage</h1>
                <p style="margin:14px 0 26px;color:#5d6470;font-size:15px;line-height:1.55;">Eine neue Anfrage wurde eingereicht und wartet auf Bearbeitung.</p>
                <div style="border-top:1px solid #e5e9ef;border-bottom:1px solid #e5e9ef;padding:8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
                </div>
                <div style="margin-top:24px;border-radius:16px;background:#f5f7fa;padding:18px;">
                  <div style="color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Nachricht / Beschreibung</div>
                  <p style="margin:9px 0 0;color:#252932;font-size:14px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(description)}</p>
                </div>
                <div style="padding-top:28px;">
                  <a href="${safeAdminUrl}" style="display:inline-block;border-radius:13px;background:#1677ff;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 22px;">Anfrage bearbeiten</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;color:#7b8492;font-size:12px;line-height:1.5;">
                <strong style="color:#596170;">ATLAS Admin System</strong><br>
                Diese Nachricht wurde automatisch generiert.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: [
      "ATLAS Admin System",
      "",
      "Neue Altfragen-Anfrage",
      "Eine neue Anfrage wurde eingereicht und wartet auf Bearbeitung.",
      "",
      ...fields.map(([label, value]) => `${label}: ${value}`),
      "",
      `Nachricht / Beschreibung: ${description}`,
      "",
      `Anfrage bearbeiten: ${data.adminUrl}`,
      "",
      "Diese Nachricht wurde automatisch generiert."
    ].join("\n")
  };
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function display(value: string | null | undefined): string {
  const text = String(value || "").trim();
  return text || "Nicht angegeben";
}

function subjectText(value: string | null | undefined): string {
  return display(value).replace(/[\r\n\t]+/g, " ").slice(0, 120);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nicht angegeben";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich"
  }).format(date);
}

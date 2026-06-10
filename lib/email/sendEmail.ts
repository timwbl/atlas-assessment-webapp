import nodemailer from "nodemailer";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  error?: { message?: string };
};

export async function sendEmail(message: EmailMessage): Promise<{ id: string | null }> {
  const smtp = smtpConfig();
  if (smtp) return sendWithSmtp(message, smtp);
  return sendWithResend(message);
}

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

async function sendWithSmtp(
  message: EmailMessage,
  config: SmtpConfig
): Promise<{ id: string | null }> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: {
      user: config.user,
      pass: config.password
    },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    tls: {
      minVersion: "TLSv1.2"
    }
  });
  const result = await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text
  });
  return { id: result.messageId || null };
}

async function sendWithResend(message: EmailMessage): Promise<{ id: string | null }> {
  const config = resendConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text
    }),
    cache: "no-store"
  });

  const data = await parseResendResponse(response);
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `E-Mail-Provider antwortete mit HTTP ${response.status}.`);
  }
  return { id: data.id || null };
}

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || "";
  const password = process.env.SMTP_PASSWORD?.trim() || "";
  const configured = !!host || !!user || !!password;
  if (!configured) return null;
  if (!host || !user || !password) {
    throw new Error("SMTP_HOST, SMTP_USER und SMTP_PASSWORD müssen gemeinsam konfiguriert sein.");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT ist ungültig.");
  }
  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureSetting
    ? secureSetting === "true"
    : port === 465;
  const from = process.env.SMTP_FROM?.trim()
    || process.env.ATLAS_EMAIL_FROM?.trim()
    || user;
  return { host, port, secure, user, password, from };
}

function resendConfig(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.ATLAS_EMAIL_FROM?.trim()
    || process.env.SMTP_FROM?.trim()
    || "";
  if (!apiKey) throw new Error("RESEND_API_KEY ist nicht konfiguriert.");
  if (!from) throw new Error("ATLAS_EMAIL_FROM ist nicht konfiguriert.");
  return { apiKey, from };
}

async function parseResendResponse(response: Response): Promise<ResendResponse> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ResendResponse;
  } catch {
    return { message: raw.slice(0, 300) };
  }
}

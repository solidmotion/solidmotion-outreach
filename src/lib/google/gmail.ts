import { google } from "googleapis";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate an OAuth2 authorization URL for Gmail access.
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
  });
}

/**
 * Exchange an authorization code for OAuth2 tokens.
 */
export async function getTokensFromCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to obtain tokens from authorization code");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

function getAuthenticatedClient(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function buildRawEmail(
  to: string,
  subject: string,
  htmlBody: string,
  fromEmail?: string
): string {
  const from = fromEmail || process.env.GMAIL_FROM_EMAIL || "me";
  const boundary = "boundary_" + Date.now().toString(36);

  const rawLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody).toString("base64"),
    "",
    `--${boundary}--`,
  ];

  const raw = rawLines.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Create a Gmail draft.
 */
export async function createDraft(
  refreshToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ draftId: string; messageId: string }> {
  const auth = getAuthenticatedClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildRawEmail(to, subject, htmlBody);

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw },
    },
  });

  return {
    draftId: response.data.id || "",
    messageId: response.data.message?.id || "",
  };
}

/**
 * Send an email directly via Gmail.
 */
export async function sendEmail(
  refreshToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ messageId: string; threadId: string }> {
  const auth = getAuthenticatedClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildRawEmail(to, subject, htmlBody);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    messageId: response.data.id || "",
    threadId: response.data.threadId || "",
  };
}

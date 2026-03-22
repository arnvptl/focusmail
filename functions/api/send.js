import { getAccessToken, jsonResponse, errorResponse } from "./_helpers.js";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

function makeRawEmail({ to, subject, body, threadId, messageId }) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject.startsWith("Re:") ? subject : "Re: " + subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];

  if (messageId) lines.push(`In-Reply-To: ${messageId}`);
  if (messageId) lines.push(`References: ${messageId}`);

  lines.push("", body);

  const raw = lines.join("\r\n");
  // Base64url encode
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function onRequestPost({ request, env }) {
  try {
    const { accessToken } = await getAccessToken(request, env);
    const { to, subject, body, threadId, messageId } = await request.json();

    if (!to || !body) return errorResponse("Missing to or body", 400);

    const raw = makeRawEmail({ to, subject: subject || "(no subject)", body, threadId, messageId });

    const payload = { raw };
    if (threadId) payload.threadId = threadId;

    const res = await fetch(`${GMAIL}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return errorResponse(`Gmail send failed: ${err}`, 502);
    }

    const sent = await res.json();
    return jsonResponse({ success: true, id: sent.id, threadId: sent.threadId });
  } catch (e) {
    if (e.message === "NOT_AUTHENTICATED")
      return errorResponse("NOT_AUTHENTICATED", 401);
    return errorResponse(e.message, 500);
  }
}

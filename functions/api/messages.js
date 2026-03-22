import { getAccessToken, jsonResponse, errorResponse } from "./_helpers.js";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(path, accessToken) {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail error ${res.status}: ${path}`);
  return res.json();
}

// Properly decode base64url → UTF-8 (fixes â€™ â€" mojibake from plain atob)
function decodeBase64Utf8(data) {
  if (!data) return "";
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function decodeBody(payload) {
  const tryDecode = decodeBase64Utf8;

  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return tryDecode(plain.body.data);
    // recurse into multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const inner = part.parts.find((p) => p.mimeType === "text/plain");
        if (inner?.body?.data) return tryDecode(inner.body.data);
      }
    }
  }

  return tryDecode(payload.body?.data);
}

function header(headers, name) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function onRequestGet({ request, env }) {
  try {
    const { accessToken } = await getAccessToken(request, env);
    const url = new URL(request.url);
    const from = url.searchParams.get("from");

    if (!from) return errorResponse("Missing 'from' param", 400);

    // Search for all messages involving that sender (sent or received)
    const query = `from:${from} OR to:${from}`;
    const list = await gmailFetch(
      `/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      accessToken
    );

    if (!list.messages?.length) return jsonResponse({ messages: [] });

    // Fetch each message in parallel (batched 10 at a time)
    const ids = list.messages.map((m) => m.id);
    const batches = [];
    for (let i = 0; i < ids.length; i += 10) {
      batches.push(ids.slice(i, i + 10));
    }

    const messages = [];
    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((id) => gmailFetch(`/messages/${id}?format=full`, accessToken))
      );
      for (const msg of results) {
        const hdrs = msg.payload.headers;
        messages.push({
          id: msg.id,
          threadId: msg.threadId,
          subject: header(hdrs, "Subject"),
          from: header(hdrs, "From"),
          to: header(hdrs, "To"),
          date: header(hdrs, "Date"),
          timestamp: msg.internalDate ? Number(msg.internalDate) : 0,
          body: decodeBody(msg.payload),
        });
      }
    }

    // Sort oldest → newest
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return jsonResponse({ messages });
  } catch (e) {
    if (e.message === "NOT_AUTHENTICATED")
      return errorResponse("NOT_AUTHENTICATED", 401);
    return errorResponse(e.message, 500);
  }
}

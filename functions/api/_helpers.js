/**
 * Retrieves a valid access token for the session, refreshing if expired.
 * Returns { accessToken } or throws if the session is invalid.
 */
export async function getAccessToken(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/fm_session=([^;]+)/);
  if (!match) throw new Error("NOT_AUTHENTICATED");

  const sessionId = match[1];
  const raw = await env.FOCUSMAIL_KV.get(`session:${sessionId}`);
  if (!raw) throw new Error("NOT_AUTHENTICATED");

  const session = JSON.parse(raw);

  // Return token if still valid (with 60s buffer)
  if (Date.now() < session.expires_at - 60_000) {
    return { accessToken: session.access_token, sessionId };
  }

  // Refresh the token
  if (!session.refresh_token) throw new Error("NOT_AUTHENTICATED");

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: session.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) throw new Error("NOT_AUTHENTICATED");

  const newTokens = await refreshRes.json();
  session.access_token = newTokens.access_token;
  session.expires_at = Date.now() + newTokens.expires_in * 1000;

  await env.FOCUSMAIL_KV.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: 60 * 60 * 24 * 30,
  });

  return { accessToken: session.access_token, sessionId };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

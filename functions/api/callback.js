export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?error=access_denied" },
    });
  }

  const redirectUri = `${url.origin}/api/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?error=token_exchange_failed" },
    });
  }

  const tokens = await tokenRes.json();

  // Store tokens in KV under a session key
  const sessionId = crypto.randomUUID();
  await env.FOCUSMAIL_KV.put(
    `session:${sessionId}`,
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    }),
    { expirationTtl: 60 * 60 * 24 * 30 } // 30 days
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `fm_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
    },
  });
}

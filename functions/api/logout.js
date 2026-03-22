import { getAccessToken, jsonResponse } from "./_helpers.js";

export async function onRequestPost({ request, env }) {
  try {
    const { sessionId } = await getAccessToken(request, env);
    await env.FOCUSMAIL_KV.delete(`session:${sessionId}`);
  } catch (_) {}

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": "fm_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}

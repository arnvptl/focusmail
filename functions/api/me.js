import { getAccessToken, jsonResponse, errorResponse } from "./_helpers.js";

export async function onRequestGet({ request, env }) {
  try {
    const { accessToken } = await getAccessToken(request, env);

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return errorResponse("Gmail profile fetch failed", 502);
    const profile = await res.json();

    return jsonResponse({ email: profile.emailAddress });
  } catch (e) {
    if (e.message === "NOT_AUTHENTICATED")
      return errorResponse("NOT_AUTHENTICATED", 401);
    return errorResponse(e.message, 500);
  }
}

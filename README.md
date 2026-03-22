# FocusMail — Cloudflare Pages Setup

A focused Gmail chat view. One person, one thread, zero noise.  
Runs entirely on **your** Cloudflare Pages deployment — no third-party AI or APIs involved.

---

## Project Structure

```
focusmail/
├── public/
│   └── index.html          ← Frontend SPA
├── functions/
│   └── api/
│       ├── _helpers.js     ← Shared token utilities
│       ├── auth.js         ← GET  /api/auth     → redirects to Google OAuth
│       ├── callback.js     ← GET  /api/callback → exchanges code for tokens
│       ├── me.js           ← GET  /api/me       → returns signed-in email
│       ├── messages.js     ← GET  /api/messages?from=email
│       ├── send.js         ← POST /api/send     → sends reply via Gmail
│       └── logout.js       ← POST /api/logout   → clears session
└── wrangler.toml
```

---

## Step 1 — Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. Create a new **OAuth 2.0 Client ID** (type: Web application)
3. Add an **Authorized Redirect URI**:
   ```
   https://YOUR-PROJECT.pages.dev/api/callback
   ```
   (Also add `http://localhost:8788/api/callback` for local dev)
4. Note down your **Client ID** and **Client Secret**

---

## Step 2 — Enable Gmail API

In Google Cloud Console → **APIs & Services → Library** → search **Gmail API** → Enable it.

---

## Step 3 — Create a Cloudflare KV Namespace

```bash
npx wrangler kv namespace create FOCUSMAIL_KV
```

Copy the `id` from the output into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "FOCUSMAIL_KV"
id = "paste-your-id-here"
```

---

## Step 4 — Deploy to Cloudflare Pages

### Option A: Connect GitHub (recommended)
1. Push this folder to a GitHub repo
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/) → **Create a project**
3. Connect your repo
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`

### Option B: Direct deploy via CLI
```bash
npm install -g wrangler
wrangler pages deploy public --project-name focusmail
```

---

## Step 5 — Set Environment Variables

In Cloudflare Pages → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |

Then also bind the KV namespace under **Settings → Functions → KV namespace bindings**:
- Variable name: `FOCUSMAIL_KV`
- KV namespace: the one you created

---

## Step 6 — Local Development

```bash
npm install -g wrangler

# Create a .dev.vars file for local secrets:
cat > .dev.vars << EOF
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
EOF

wrangler pages dev public --kv FOCUSMAIL_KV
```

Visit `http://localhost:8788`

---

## How It Works

1. User visits `/` → app checks `/api/me`
2. If not signed in → shows Login screen → `/api/auth` redirects to Google
3. Google redirects to `/api/callback` → tokens stored in Cloudflare KV (session cookie set)
4. User enters a sender email → frontend calls `/api/messages?from=...`
5. Cloudflare Function fetches from Gmail API directly using stored OAuth token
6. Replies go via `/api/send` → Gmail API sends the email
7. Auto-refresh every 30s; tab badge + sound on new messages

---

## Notes

- Tokens are stored server-side in Cloudflare KV (never exposed to frontend)
- Access tokens are auto-refreshed using the stored refresh token
- Sessions expire after 30 days
- No data is ever sent to any AI service

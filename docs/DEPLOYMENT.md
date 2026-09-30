# Deployment

## Docker

1. Create a private `.env` from `.env.example` and set the owner number plus any provider credentials.
2. Build: `docker build -t kiteframe-wa .`
3. Run with persistent state and secret injection, for example:

```sh
docker run -d --name kiteframe \
  --env-file .env \
  -v kiteframe-auth:/app/auth \
  -v kiteframe-data:/app/data \
  --restart unless-stopped \
  kiteframe-wa
```

The image installs FFmpeg, runs as the unprivileged `bun` account, and declares separate persistent volumes for session and database state. Back up the volumes securely. Pair once by reading the startup QR from the container logs (`docker logs -f kiteframe`). Do not publish the auth volume or logs. For production, inject secrets from the host's secret manager rather than storing an `.env` file in the image or repository.

## Direct Bun runtime

Install Bun 1.2 or newer and FFmpeg with WebP support. Run `bun install --frozen-lockfile`, configure `.env`, then run `bun run start`. Keep `auth/` and `data/` writable only by the service account. Use a process supervisor to restart the service after host maintenance; the application reconnects with capped exponential backoff after transient link failures. A logged-out session requires removing its stale auth state and pairing again.

## Troubleshooting

- **Owner numbers required:** set `KITEFRAME_OWNER_NUMBERS` with country code and digits, without a leading plus.
- **No QR appears:** check that the session has not already been paired and that logs are visible. Keep terminal output private while pairing.
- **Connection repeatedly closes:** verify the paired phone has internet and review the structured status code in logs. Re-pair only after confirming the session was logged out.
- **Moderation cannot delete links or kick:** promote the bot to group admin; group settings are off until an admin enables them.
- **Sticker conversion fails:** install FFmpeg with libwebp support and confirm the configured executable path. Input size and video length are intentionally bounded.
- **AI command unavailable:** set a supported provider, correct model/endpoint, and secret API key. Tests do not call providers; use a controlled provider account for a manual check.
- **Database locked/unavailable:** ensure one application instance writes a given SQLite file, that the data volume is writable, and that WAL sidecar files are kept with the database.

## Operations and recovery

Treat WhatsApp auth as a credential. Restrict access, encrypt backups, and revoke/re-pair if the files are exposed. The local database contains identifiers and possibly AI memory if explicitly enabled. Establish retention and backup policies appropriate to the deployment. Graceful SIGINT/SIGTERM closes the socket and database; a power loss is recovered through SQLite WAL and persisted Baileys auth.

# Kiteframe

Kiteframe is a modular WhatsApp automation platform built with Bun, TypeScript, Baileys, and SQLite. It focuses on a small, maintainable core: discoverable command plugins, centralized access rules, per-group settings, opt-in AI providers, bounded media conversion, and structured operational logs.

It does not ship with an account session or API credentials. You connect your own WhatsApp account and choose whether to enable an AI provider.

## Requirements

- Bun 1.2 or newer (CI is pinned to 1.3.14)
- FFmpeg with WebP support for `/sticker`
- A WhatsApp account for QR linking
- Optional: an API key for a supported AI provider

## Quick start

```sh
bun install --frozen-lockfile
cp .env.example .env
# Edit .env: set KITEFRAME_OWNER_NUMBERS to your international phone number(s)
bun run start
```

On first run, scan the terminal QR from WhatsApp → Linked devices. The session is stored under `./auth/`; treat it like a password. Keep this directory private and persistent. The local SQLite database is stored in `./data/` by default.

## Configuration

All settings use the `KITEFRAME_` prefix. See [configuration reference](docs/CONFIGURATION.md) and `.env.example`. Owner numbers are required; startup fails rather than using a placeholder owner. `KITEFRAME_AI_PROVIDER=disabled` is the default. Choose `openai-compatible`, `gemini`, or `ollama` to enable AI; set provider credentials only through the environment. AI conversation memory is off by default and is private-chat only when enabled.

## Commands

Use `/help` for the live command catalogue. Command modules live under `src/commands/<category>/`; the loader validates metadata and rejects duplicate triggers at startup. Each command declares its permission level, chat restrictions, and cooldown in its own module. See [command reference](docs/COMMANDS.md).

Initial commands include `help`, `ping`, `about`, `privacy`, `ask`, `vision`, `summarize`, `settings`, `kick`, `warn`, `sticker`, `prefix`, and `feature`. Group link filtering and greetings are disabled per group until an administrator enables them. The bot must be a group admin to delete restricted links or change membership.

## Development and verification

```sh
bun run lint       # TypeScript strict type-check
bun test           # deterministic local tests
bun run smoke      # command catalogue + config + SQLite smoke checks
bun run dev        # watch-mode startup
```

A live WhatsApp startup requires pairing and is intentionally not run in CI. AI integration tests use mocked provider responses; external providers are never contacted by the test suite. Docker deployment is described in [deployment](docs/DEPLOYMENT.md).

## Architecture and privacy

The transport adapter is isolated from command logic; message handlers normalize events before centralized dispatch. SQLite stores per-group preferences, feature switches, command usage identifiers, moderation warnings, and optionally private AI memory. Message text is not written to logs or retained by default, except group-admin warning reasons (retained locally for up to 180 days). Usage identifiers are pruned after 90 days. AI prompts and images are sent to the operator-selected provider, so review its data-retention terms. `/privacy` summarizes runtime behavior.

## Licensing and third-party notices

This distribution retains the MIT `LICENSE` notice accompanying source material from the supplied repository. Its copyright and permission text are preserved there as required by the MIT terms. The new application structure, configuration, command catalogue, and documentation have been substantially rebuilt; this does not assert that all historical code was newly authored. Baileys and other runtime dependencies remain subject to their own licenses. No inherited image or game-data assets are included because their provenance could not be verified.

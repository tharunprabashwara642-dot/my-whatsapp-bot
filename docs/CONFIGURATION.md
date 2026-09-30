# Configuration

Copy `.env.example` to `.env`. Bun loads local `.env` files automatically. Never commit `.env` or place credentials in source code, container images, or command output. Settings may also be injected by a deployment secret manager.

| Variable                            | Default                   | Notes                                                                                                                                                 |
| ----------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KITEFRAME_NAME`                    | `Kiteframe`               | Display name used by menus and greetings.                                                                                                             |
| `KITEFRAME_OWNER_NUMBERS`           | required                  | Comma-separated international phone numbers, digits only. Startup fails when unset/empty.                                                             |
| `KITEFRAME_SUDO_NUMBERS`            | empty                     | Optional trusted operators; not granted owner-only configuration.                                                                                     |
| `KITEFRAME_PREFIXES`                | `/`                       | Comma-separated accepted prefixes; owner can change the primary prefix with `/prefix`.                                                                |
| `KITEFRAME_ACCESS_MODE`             | `public`                  | `public`, `private` (owner-only in groups), or `self` (owner-only).                                                                                   |
| `KITEFRAME_TIMEZONE`                | `UTC`                     | Valid IANA timezone.                                                                                                                                  |
| `KITEFRAME_LANGUAGE`                | `en`                      | Reserved for future localization; current messages are English.                                                                                       |
| `KITEFRAME_DATABASE_PATH`           | `./data/kiteframe.sqlite` | SQLite path; use a persistent private volume. `:memory:` is useful for tests.                                                                         |
| `KITEFRAME_AUTH_DIR`                | `./auth`                  | Baileys multi-file auth directory. Protect as a session secret.                                                                                       |
| `KITEFRAME_LOG_LEVEL`               | `info`                    | Pino level; logs redact common credential fields. Never enable message-body logging.                                                                  |
| `KITEFRAME_AI_PROVIDER`             | `disabled`                | `disabled`, `openai-compatible`, `gemini`, or `ollama`.                                                                                               |
| `KITEFRAME_AI_MODEL`                | provider-specific         | Model name sent to the selected provider.                                                                                                             |
| `KITEFRAME_AI_ENDPOINT`             | provider default          | OpenAI-compatible base URL, Gemini API root, or Ollama OpenAI-compatible endpoint.                                                                    |
| `KITEFRAME_AI_API_KEY`              | empty                     | Secret key for remote providers; do not commit it. Ollama can run without a key.                                                                      |
| `KITEFRAME_AI_TEMPERATURE`          | `0.7`                     | Numeric range 0–2.                                                                                                                                    |
| `KITEFRAME_AI_MAX_TOKENS`           | `700`                     | Output cap, range 1–16,000.                                                                                                                           |
| `KITEFRAME_AI_SYSTEM_PROMPT`        | concise assistant         | Operator-selected instruction.                                                                                                                        |
| `KITEFRAME_AI_MEMORY`               | `false`                   | Store bounded private-chat turns locally; off by default, never used in groups. Memory is pruned after 90 days; `/ask clear` removes a user's memory. |
| `KITEFRAME_MEDIA_MAX_BYTES`         | 8 MiB                     | Maximum media input/output size; allowed range 1 KiB–50 MiB.                                                                                          |
| `KITEFRAME_MEDIA_MAX_VIDEO_SECONDS` | 8                         | Maximum video time processed by sticker conversion; allowed range 1–30 sec.                                                                           |
| `KITEFRAME_FFMPEG_PATH`             | `ffmpeg`                  | Executable path resolved by the operating system.                                                                                                     |
| `KITEFRAME_FFPROBE_PATH`            | `ffprobe`                 | Media metadata probe used to reject extreme image dimensions before conversion.                                                                       |

AI prompt text and images are sent to the configured provider. Confirm provider privacy, retention, and model capabilities before enabling `/ask` or `/vision`. Gemini and OpenAI-compatible services require vision support for image analysis. A configured remote endpoint must use HTTPS; local Ollama may use loopback HTTP. Command usage identifiers are deleted after 90 days; group warning reasons after 180 days.

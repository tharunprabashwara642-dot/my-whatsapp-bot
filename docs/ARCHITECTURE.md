# Architecture

Kiteframe separates WhatsApp transport, message handling, command policy, persistence, and external providers so commands do not own connection lifecycle or data access setup.

## Runtime path

1. `src/index.ts` validates environment configuration, opens SQLite, and starts the connection service.
2. `src/connection/whatsapp.ts` owns Baileys auth state, QR display, connection events, reconnect backoff, and graceful socket shutdown. Full WhatsApp history sync is disabled.
3. `src/handlers/message-handler.ts` filters system/broadcast traffic, normalizes sender/chat identities, obtains group roles, applies group policy, parses the active prefix, and builds a transport-neutral `CommandContext`.
4. `src/core/dispatcher.ts` enforces command availability, role/chat restrictions, access mode, cooldowns, and usage accounting before invoking a plugin.
5. `src/commands/<category>/*.ts` contain independently discoverable command definitions. `src/core/command-loader.ts` checks metadata and rejects collisions instead of choosing an arbitrary winner.
6. Reusable integrations live in `src/services/`: provider-neutral AI requests, FFmpeg-based sticker conversion, and per-group moderation actions.
7. `src/core/database.ts` owns SQLite schema setup and repository operations. WAL mode and parameterized statements are used.

## Permission model

The dispatcher recognizes normal users, configured sudo numbers, group admins, and explicitly configured owners. Owners are identified by configured international phone numbers; no placeholder owner is accepted. Command permission metadata is evaluated centrally. Sudo users bypass cooldowns and can administer groups, but owner-only configuration commands remain owner-only.

## Persistence and privacy

SQLite stores group preferences, feature toggles, command usage identifiers, warnings, and (only when explicitly enabled) private-chat AI memory. Message bodies are not written to logs or retained by default, except group-admin warning reasons, which are retained locally for up to 180 days. Usage identifiers and optional AI memory are pruned after 90 days. AI memory retains at most 8 recent exchanges per user and is never used in groups. The database and WhatsApp auth directory are local state and must be persisted securely by the deployment operator.

## Deliberate boundaries

There is no arbitrary code execution, generic user-supplied URL fetcher, unofficial downloader farm, bulk-message feature, or automatic view-once media forwarding. Scheduled reminders and outbound campaigns are not included in this initial release. Media conversion uses an argument-array process call, private temporary files, streaming input/output limits, a bounded conversion queue, a single FFmpeg thread, and a timeout. Incoming message work and provider calls also have bounded concurrency/queues; shutdown stops new work and drains active message tasks. AI network endpoints are operator configuration, not message input. Add future providers behind `src/services/ai.ts` and add deterministic mocked tests before connecting them to commands.

# Command reference

The active prefix defaults to `/` and can be changed by the owner in a private chat. `/help` lists registered commands dynamically; `/help group` filters by category. A command may include aliases, usage text, permission, group/private restrictions, bot-admin requirements, cooldown, and enabled state. Duplicate command names or aliases fail startup.

| Command                                   | Category | Access                           | Purpose                                                                                       |
| ----------------------------------------- | -------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| `/help [category]`                        | General  | All chats                        | Show the current command catalogue. Alias: `/menu`.                                           |
| `/ping`                                   | General  | All chats                        | Check responsiveness.                                                                         |
| `/about`                                  | General  | All chats                        | Show product and runtime status.                                                              |
| `/privacy`                                | General  | All chats                        | Explain local storage and AI handling.                                                        |
| `/ask <question>`                         | AI       | All chats                        | Ask configured text model. Alias: `/ai`. In private chats, `/ask clear` deletes saved memory. |
| `/vision [question]`                      | AI       | All chats                        | Analyze an attached image with a vision-capable provider.                                     |
| `/summarize <text>`                       | AI       | All chats                        | Summarize provided text or a replied-to message. Alias: `/summary`.                           |
| `/settings [antilink\|welcome] [on\|off]` | Group    | Group admins                     | Read/update this group's moderation and greeting settings. Both default off.                  |
| `/kick @member`                           | Group    | Group admins; bot admin required | Remove a mentioned or replied-to participant.                                                 |
| `/warn @member [reason]`                  | Group    | Group admins                     | Record a moderation warning.                                                                  |
| `/sticker`                                | Media    | All chats                        | Convert an attached image or short video to WebP sticker. Alias: `/st`.                       |
| `/prefix <symbol>`                        | Owner    | Configured owner, private chat   | Change the active prefix.                                                                     |
| `/feature <command> on\|off`              | Owner    | Configured owner, private chat   | Persistently enable/disable a command by primary name.                                        |

## Group controls

Settings are stored per group. Anti-link removes WhatsApp invite links only when the bot can perform the delete action; failures are logged without exposing message content. A group admin can turn it on using `/settings antilink on`. Welcome/goodbye messages require `/settings welcome on`. Make the bot a group admin before expecting moderation actions to succeed.

## Adding a command

Create a TypeScript module in the appropriate category directory, default-export `defineCommand({...})`, and specify a unique `name`, `category`, `description`, and async `handler`. Add permission and chat constraints in metadata rather than inside unrelated command files. Add a unit test for parsing/policy logic where applicable, then run `bun run lint`, `bun test`, and `bun run smoke`.

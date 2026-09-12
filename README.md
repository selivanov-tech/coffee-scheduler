# coffee-scheduler

A Telegram bot for a coffee-shop manager to chat with the worker schedule in plain Russian. The schedule lives in Google Sheets; the bot reads it, answers questions, finds gaps, and proposes edits that a manager confirms before anything is written.

Node.js + TypeScript (ESM), grammY, Tigris (S3-compatible) for ops state. Deploy target: Fly.io with zero-scale (deploy config is not in the repo yet, see Roadmap).

[![CI](https://github.com/selivanov-tech/coffee-scheduler/actions/workflows/ci.yml/badge.svg)](https://github.com/selivanov-tech/coffee-scheduler/actions/workflows/ci.yml)

> Public portfolio repo. It contains only fake example config and synthetic fixtures. Real tokens, spreadsheet IDs, branch names, and worker data are never committed; CI runs gitleaks on every push.

## Status

**Slice 1 is done: a running webhook bot with auth, health check and durable user storage.** The AI message router, Sheets read path, analytics, gap finding and the confirm-before-write path are the next slices (see Roadmap).

What works today:

- `GET /health` and `POST /webhook` on a plain Node `http` server (no web framework).
- grammY bot behind the webhook; Telegram's `X-Telegram-Bot-Api-Secret-Token` is validated, requests with a missing or forged secret are rejected with `401`; the webhook URL is registered with `setWebhook` on every boot.
- **Allow-list auth**: the bot only answers users listed in `users.json`; strangers are ignored silently. Roles: `admin` / `staff`.
- **Admin commands**: `/add_user <telegram_id> [staff|admin] <name>`, `/remove_user <telegram_id>`, `/list_users`.
- **Durable user store in Tigris**: `users.json` is read and written with ETag-conditional `PutObject` (`If-Match`), so two concurrent edits cannot overwrite each other; conflicts retry.
- **Bootstrap on first boot**: `HeadBucket` fail-fast, then the admin from env is seeded with `If-None-Match: *` (idempotent — a second boot does not duplicate).
- **Config validated at boot** with `zod`: missing or inconsistent values fail fast with a readable list of issues (for example, the agent turn deadline must be below the webhook timeout).
- **Crash safety and graceful shutdown**: `unhandledRejection` / `uncaughtException` exit with an error; `SIGTERM` / `SIGINT` close the HTTP server, drain in-flight requests, and time out to a forced exit.

## How it will work (design)

The safety rule of the whole design: **no AI tool writes to the schedule**. A small model only translates messy Telegram text into a safe intent / tool plan. TypeScript code does the math and the validation. Writes happen only in the Confirm handler, after re-validation, outside the AI loop, behind a single-writer lock, with a snapshot backup and an audit record in Tigris.

```
Telegram ─POST /webhook─▶ secret check ─▶ allow-list ─▶ message router (small model → intent + tool plan)
                                                              │
                                                 read tools: get_schedule · summarize_hours · find_gaps · list_workers
                                                              │
                                                 propose_edit → validate → pending/<id>.json in Tigris (no write)
                                                              │
                                              Confirm tap → re-validate → backup snapshot → write to Sheets → audit
```

The full design (message flow, data model, concurrency rules, deployment) lives in the project notes and is being built slice by slice.

## Project layout

```
src/
  index.ts            composition root: config → Tigris → bootstrap → users → bot → HTTP server
  config.ts           zod env schema → typed Config, fails fast
  lifecycle.ts        crash handlers + graceful shutdown (testable unit)
  http/server.ts      Node http server: GET /health, POST /webhook seam
  bot/
    bot.ts            grammY bot wiring: error handler, auth middleware, commands
    webhook.ts        grammY webhookCallback with secret token + timeout
    auth.ts           allow-list middleware, isAdmin()
    context.ts        BotContext type (ctx.user set by the auth middleware)
    parse.ts          pure command-argument parsers
    userCommands.ts   /add_user, /remove_user, /list_users
  ops/
    tigrisClient.ts   S3Client for Tigris
    users.ts          users.json primitives: read, ETag-conditional put, create-if-absent, update with retry
    usersService.ts   in-memory allow-list cache + add/remove writing through the store
    bootstrap.ts      HeadBucket fail-fast + idempotent admin seed
tests/                vitest, no credentials needed (fake S3 helper, offline grammY bot)
```

Business logic stays in pure functions; side effects (Telegram, Tigris, later Sheets) live in adapters. Untrusted input is validated at the boundary with `zod`.

## Run locally

Prerequisites: Node 20+ (CI runs on Node 22), a bot token from @BotFather, a Tigris (or any S3-compatible) bucket, and a public HTTPS URL for the webhook (ngrok / cloudflared for local runs).

```sh
npm install
cp .env.example .env      # fill real values; .env is gitignored
npm run dev               # node --env-file=.env, registers the webhook on boot
```

```sh
npm run typecheck
npm test                  # vitest, 41 tests, no network or credentials
npm run lint && npm run format:check
npm run build && npm start
```

## Configuration

All configuration comes from environment variables, validated by [`src/config.ts`](src/config.ts). See [`.env.example`](.env.example) for the full list with fake values. Groups: Telegram (token, webhook secret), AI provider (Anthropic in v1), Google Sheets (service-account JSON, spreadsheet id), admin seed, Tigris (S3 keys, endpoint, bucket), runtime (public URL, port, shop timezone), and hard caps (pending-proposal TTL, max tool iterations, tool timeout, agent turn deadline, webhook timeout).

## Testing

The whole suite runs offline:

- `ops/users.ts`: ETag logic against a fake S3 (`412` → retry, `If-None-Match` create-if-absent).
- `ops/bootstrap.ts`: bucket fail-fast and idempotent seed.
- `bot/webhook.ts` end to end: a real grammY bot with `botInfo` preset (skips `getMe`), outgoing API calls mocked through a transformer, driven by crafted webhook POSTs — forged secret rejected, stranger ignored, admin commands round-trip.
- `bot/parse.ts`, `http/server.ts`, `lifecycle.ts`, `config.ts`.

CI (`.github/workflows/ci.yml`): lint + format check, typecheck, tests, build, and a gitleaks secret scan.

## Roadmap

1. ~~Skeleton + auth + health + Tigris bootstrap~~ — done.
2. Strict-format Sheets read path, `AIProvider` interface, Anthropic adapter, small-model message router that turns free-form Russian into safe tool plans (read-only).
3. Analytics: hours per worker / per day, weekly soft-limit warnings.
4. Gap finding with required coverage per position, availability and role-based candidates.
5. Write path: `propose_edit` → durable pending proposal → Confirm / Cancel with TTL, idempotent confirm (`If-Match` claim), single-writer queue, backup snapshot, audit, `/undo`.
6. Polish: rate limit, agent caps with friendly fallback, `update_id` dedupe, keep-alive while work is active under Fly auto-stop, `/help`.
7. Deploy: Fly secrets, zero-scale machine, end-to-end check from the phone.

## License

MIT — see [LICENSE](LICENSE).

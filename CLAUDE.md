# CLAUDE.md

Guidance for working in this repo.

## What this is

A Telegram bot to chat with a coffee-shop schedule (Google Sheets). Node.js + TypeScript (ESM). See [README](README.md).

## Comments

- **Comments are the exception, not the default.** Write one only for genuinely hard logic — a non-obvious algorithm, a subtle invariant, or a "why" the code cannot show on its own.
- **Names do the work.** Prefer a clear name over a comment. If you reach for a comment to explain a variable or function, rename it instead.
- **Do not restate the code.** No comment that just repeats what the next line already says.
- **No ephemeral notes in source.** No build-slice numbers, ticket ids, or "placeholder" markers. That context belongs in the README, docs, or the commit message.
- **Section headers are fine** for grouping a long, flat list where the groups are not otherwise visible (e.g. the `envSchema` in `config.ts`).
- **Tests may comment freely.** Use comments in tests to name cases and document intent.

## Style

- ESM, strict TypeScript (`tsconfig` is strict + NodeNext).
- Validate untrusted input at the boundary with `zod` (env, tool inputs, sheet cells).
- Keep business logic in pure functions; isolate side effects (Sheets, Tigris, Telegram) in adapters.

## Safety

- Public repo. Never commit real secrets, spreadsheet ids, branch codes, or worker data — only fake/example values and synthetic fixtures. See [README](README.md) and `.gitignore`.

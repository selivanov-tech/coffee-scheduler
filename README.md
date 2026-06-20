# coffee-scheduler

A Telegram bot to chat with a coffee-shop worker schedule in plain language.
The schedule lives in Google Sheets; the bot reads it, finds gaps, and proposes
edits that a manager confirms before anything is written.

> **Portfolio project.** This repo contains only example/fake config and synthetic
> fixtures. Real tokens, spreadsheet IDs, branch names, and worker data are never
> committed.

## Status

Early skeleton — project setup only. No bot logic yet.

## Stack

- Node.js + TypeScript (ESM)
- [grammY](https://grammy.dev) (Telegram), `googleapis` (Sheets),
  `@anthropic-ai/sdk` (AI), `@aws-sdk/client-s3` (Tigris, S3-compatible)
- `zod` (config + input validation), `vitest` (tests)
- Fly.io (webhook + zero-scale)

Only `zod` is wired so far. The rest are added per build slice.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in real values (`.env` is gitignored).
3. `npm run typecheck` — type-check the project.
4. `npm test` — run unit tests.
5. `npm run dev` — load config and run the entry point (smoke test).

## Configuration

All configuration comes from environment variables, validated on boot by
[`src/config.ts`](src/config.ts). It fails fast with a clear message if anything
is missing or invalid. See [`.env.example`](.env.example) for the full list.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run with tsx and a local `.env` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled app |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run the vitest suite |

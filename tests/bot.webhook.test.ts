import { describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { S3Client } from "@aws-sdk/client-s3";
import { createBot } from "../src/bot/bot.js";
import { createWebhookHandler } from "../src/bot/webhook.js";
import { createServer } from "../src/http/server.js";
import { USERS_KEY, type UsersFile } from "../src/ops/users.js";
import { UsersService } from "../src/ops/usersService.js";
import { FakeS3 } from "./helpers/fakeS3.js";

const SECRET = "s3cr3t";
const T = "2026-06-20T00:00:00.000Z";
const ADMIN_ID = 42;
const STAFF_ID = 7;

const botInfo = {
  id: 1,
  is_bot: true as const,
  first_name: "Test",
  username: "test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
};

const seeded: UsersFile = {
  users: [
    { telegram_id: String(ADMIN_ID), name: "Boss", role: "admin", added_at: T },
    { telegram_id: String(STAFF_ID), name: "Crew", role: "staff", added_at: T },
  ],
  updated_at: T,
};

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

async function start(): Promise<{
  baseUrl: string;
  sent: Sent[];
  fake: FakeS3;
  server: Server;
}> {
  const fake = new FakeS3({ [USERS_KEY]: JSON.stringify(seeded) });
  const users = new UsersService(fake as unknown as S3Client, "ops", () => T);
  await users.refresh();

  const bot = createBot({ token: "12345:TEST", users, botInfo });
  const sent: Sent[] = [];
  const transformer = (
    _prev: unknown,
    method: string,
    payload: Record<string, unknown>,
  ) => {
    sent.push({ method, payload });
    return Promise.resolve({
      ok: true,
      result: { message_id: 1, date: 0, chat: { id: 0, type: "private" } },
    });
  };
  bot.api.config.use(
    transformer as unknown as Parameters<typeof bot.api.config.use>[0],
  );

  const onWebhook = createWebhookHandler(bot, {
    secretToken: SECRET,
    timeoutMs: 5000,
  });
  const server = createServer({ onWebhook });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, sent, fake, server };
}

function commandUpdate(fromId: number, text: string, updateId = 1): unknown {
  const command = text.split(" ", 1)[0] ?? text;
  return {
    update_id: updateId,
    message: {
      message_id: 100 + updateId,
      date: 1700000000,
      chat: { id: fromId, type: "private" },
      from: { id: fromId, is_bot: false, first_name: "U" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: command.length }],
    },
  };
}

async function post(
  baseUrl: string,
  update: unknown,
  secret?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret !== undefined) headers["x-telegram-bot-api-secret-token"] = secret;
  return fetch(`${baseUrl}/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });
}

async function withServer(
  fn: (env: Awaited<ReturnType<typeof start>>) => Promise<void>,
): Promise<void> {
  const env = await start();
  try {
    await fn(env);
  } finally {
    await new Promise<void>((resolve) => env.server.close(() => resolve()));
  }
}

describe("webhook + auth + user commands", () => {
  it("rejects a forged secret token with 401 and runs nothing", async () => {
    await withServer(async ({ baseUrl, sent }) => {
      const res = await post(
        baseUrl,
        commandUpdate(ADMIN_ID, "/list_users"),
        "wrong",
      );
      expect(res.status).toBe(401);
      expect(sent).toHaveLength(0);
    });
  });

  it("rejects a missing secret token with 401", async () => {
    await withServer(async ({ baseUrl }) => {
      const res = await post(baseUrl, commandUpdate(ADMIN_ID, "/list_users"));
      expect(res.status).toBe(401);
    });
  });

  it("admin /add_user persists the user and replies", async () => {
    await withServer(async ({ baseUrl, sent, fake }) => {
      const res = await post(
        baseUrl,
        commandUpdate(ADMIN_ID, "/add_user 555 staff Новенький"),
        SECRET,
      );
      expect(res.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.method).toBe("sendMessage");
      expect(String(sent[0]?.payload.text)).toContain("Добавлен");

      const persisted = JSON.parse(fake.raw(USERS_KEY)!.body) as UsersFile;
      expect(persisted.users.map((u) => u.telegram_id)).toContain("555");
    });
  });

  it("ignores a stranger silently (no reply, no write)", async () => {
    await withServer(async ({ baseUrl, sent, fake }) => {
      const res = await post(
        baseUrl,
        commandUpdate(999, "/add_user 555 staff X"),
        SECRET,
      );
      expect(res.status).toBe(200);
      expect(sent).toHaveLength(0);
      const persisted = JSON.parse(fake.raw(USERS_KEY)!.body) as UsersFile;
      expect(persisted.users).toHaveLength(2);
    });
  });

  it("refuses an admin command from a staff user", async () => {
    await withServer(async ({ baseUrl, sent, fake }) => {
      const res = await post(
        baseUrl,
        commandUpdate(STAFF_ID, "/add_user 555 staff X"),
        SECRET,
      );
      expect(res.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(String(sent[0]?.payload.text)).toContain("администратор");
      const persisted = JSON.parse(fake.raw(USERS_KEY)!.body) as UsersFile;
      expect(persisted.users).toHaveLength(2);
    });
  });
});

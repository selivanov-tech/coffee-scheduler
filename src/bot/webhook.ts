import { type Bot, webhookCallback } from "grammy";
import type { RequestHandler } from "../http/server.js";
import type { BotContext } from "./context.js";

export interface WebhookOptions {
  secretToken: string;
  timeoutMs: number;
}

export function createWebhookHandler(
  bot: Bot<BotContext>,
  options: WebhookOptions,
): RequestHandler {
  return webhookCallback(bot, "http", {
    secretToken: options.secretToken,
    timeoutMilliseconds: options.timeoutMs,
  });
}

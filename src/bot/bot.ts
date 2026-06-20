import { Bot, type BotConfig } from "grammy";
import type { UsersService } from "../ops/usersService.js";
import { authMiddleware } from "./auth.js";
import type { BotContext } from "./context.js";
import { registerUserCommands } from "./userCommands.js";

export interface CreateBotDeps {
  token: string;
  users: UsersService;
  botInfo?: BotConfig<BotContext>["botInfo"];
}

export function createBot(deps: CreateBotDeps): Bot<BotContext> {
  const bot = new Bot<BotContext>(
    deps.token,
    deps.botInfo ? { botInfo: deps.botInfo } : undefined,
  );

  bot.catch((err) => {
    console.error("bot error on update", err.ctx.update.update_id, err.error);
  });

  bot.use(authMiddleware(deps.users));
  registerUserCommands(bot, deps.users);
  return bot;
}

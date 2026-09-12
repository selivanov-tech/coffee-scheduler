import type { Bot } from "grammy";
import { UserExistsError, type UsersService } from "../ops/usersService.js";
import { isAdmin } from "./auth.js";
import type { BotContext } from "./context.js";
import { parseAddUser, parseRemoveUser } from "./parse.js";

const ADMIN_ONLY = "Эта команда только для администратора.";

export function registerUserCommands(
  bot: Bot<BotContext>,
  users: UsersService,
): void {
  bot.command("add_user", async (ctx) => {
    if (!isAdmin(ctx)) return void (await ctx.reply(ADMIN_ONLY));

    const parsed = parseAddUser(ctx.message?.text ?? "");
    if (!parsed.ok) return void (await ctx.reply(parsed.error));

    try {
      const user = await users.add(parsed.value);
      await ctx.reply(
        `Добавлен: ${user.name} (${user.role}), id ${user.telegram_id}.`,
      );
    } catch (err) {
      if (err instanceof UserExistsError) {
        await ctx.reply("Такой пользователь уже есть.");
        return;
      }
      throw err;
    }
  });

  bot.command("remove_user", async (ctx) => {
    if (!isAdmin(ctx)) return void (await ctx.reply(ADMIN_ONLY));

    const parsed = parseRemoveUser(ctx.message?.text ?? "");
    if (!parsed.ok) return void (await ctx.reply(parsed.error));

    const removed = await users.remove(parsed.value.telegramId);
    await ctx.reply(
      removed ? "Пользователь удалён." : "Пользователь не найден.",
    );
  });

  bot.command("list_users", async (ctx) => {
    if (!isAdmin(ctx)) return void (await ctx.reply(ADMIN_ONLY));

    const list = users.list();
    if (list.length === 0) return void (await ctx.reply("Список пуст."));

    const lines = list.map(
      (u) => `• ${u.name} — ${u.role} — id ${u.telegram_id}`,
    );
    await ctx.reply(lines.join("\n"));
  });
}

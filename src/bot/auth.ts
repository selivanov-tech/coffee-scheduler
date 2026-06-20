import type { NextFunction } from "grammy";
import type { UsersService } from "../ops/usersService.js";
import type { BotContext } from "./context.js";

export function authMiddleware(users: UsersService) {
  return async (ctx: BotContext, next: NextFunction): Promise<void> => {
    const id = ctx.from?.id;
    if (id === undefined) return;
    const user = users.find(String(id));
    if (!user) return;
    ctx.user = user;
    await next();
  };
}

export function isAdmin(ctx: BotContext): boolean {
  return ctx.user?.role === "admin";
}

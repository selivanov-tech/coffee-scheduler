import type { Context } from "grammy";
import type { UserRecord } from "../ops/users.js";

export type BotContext = Context & { user?: UserRecord };

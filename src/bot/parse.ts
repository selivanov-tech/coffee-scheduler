import type { UserRole } from "../ops/users.js";

export interface AddUserArgs {
  telegramId: string;
  role: UserRole;
  name: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseAddUser(text: string): ParseResult<AddUserArgs> {
  const parts = args(text);
  if (parts.length < 2) {
    return {
      ok: false,
      error: "usage: /add_user <telegram_id> [staff|admin] <name>",
    };
  }
  const [telegramId, second, ...rest] = parts;
  if (!isNumericId(telegramId)) {
    return { ok: false, error: "telegram_id must be a number" };
  }

  let role: UserRole = "staff";
  let nameParts = [second, ...rest];
  if (second === "staff" || second === "admin") {
    role = second;
    nameParts = rest;
  }

  const name = nameParts.join(" ").trim();
  if (!name) return { ok: false, error: "name is required" };
  return { ok: true, value: { telegramId, role, name } };
}

export function parseRemoveUser(
  text: string,
): ParseResult<{ telegramId: string }> {
  const [telegramId] = args(text);
  if (!telegramId) {
    return { ok: false, error: "usage: /remove_user <telegram_id>" };
  }
  if (!isNumericId(telegramId)) {
    return { ok: false, error: "telegram_id must be a number" };
  }
  return { ok: true, value: { telegramId } };
}

function args(text: string): string[] {
  return text
    .replace(/^\/\w+(@\w+)?/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isNumericId(value: string | undefined): value is string {
  return value !== undefined && /^\d+$/.test(value);
}

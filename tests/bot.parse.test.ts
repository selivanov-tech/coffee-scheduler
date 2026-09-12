import { describe, expect, it } from "vitest";
import { parseAddUser, parseRemoveUser } from "../src/bot/parse.js";

describe("parseAddUser", () => {
  it("parses id, explicit role, and a multi-word name", () => {
    const r = parseAddUser("/add_user 12345 admin Иван Петров");
    expect(r).toEqual({
      ok: true,
      value: { telegramId: "12345", role: "admin", name: "Иван Петров" },
    });
  });

  it("defaults the role to staff when omitted", () => {
    const r = parseAddUser("/add_user 12345 Иван Петров");
    expect(r.ok && r.value).toEqual({
      telegramId: "12345",
      role: "staff",
      name: "Иван Петров",
    });
  });

  it("tolerates a bot username suffix and extra spaces", () => {
    const r = parseAddUser("/add_user@coffeebot   777   staff   Аружан");
    expect(r.ok && r.value.telegramId).toBe("777");
    expect(r.ok && r.value.name).toBe("Аружан");
  });

  it("rejects a non-numeric id", () => {
    const r = parseAddUser("/add_user abc staff Имя");
    expect(r.ok).toBe(false);
  });

  it("rejects a missing name", () => {
    const r = parseAddUser("/add_user 12345 admin");
    expect(r.ok).toBe(false);
  });

  it("rejects when too few arguments", () => {
    expect(parseAddUser("/add_user 12345").ok).toBe(false);
  });
});

describe("parseRemoveUser", () => {
  it("parses a numeric id", () => {
    expect(parseRemoveUser("/remove_user 12345")).toEqual({
      ok: true,
      value: { telegramId: "12345" },
    });
  });

  it("rejects a missing id", () => {
    expect(parseRemoveUser("/remove_user").ok).toBe(false);
  });

  it("rejects a non-numeric id", () => {
    expect(parseRemoveUser("/remove_user nope").ok).toBe(false);
  });
});

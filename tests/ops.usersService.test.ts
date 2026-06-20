import { describe, expect, it } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import { USERS_KEY, type UsersFile } from "../src/ops/users.js";
import { UserExistsError, UsersService } from "../src/ops/usersService.js";
import { FakeS3 } from "./helpers/fakeS3.js";

const BUCKET = "ops-test";
const T = "2026-06-20T00:00:00.000Z";

const seeded: UsersFile = {
  users: [
    { telegram_id: "1", name: "Admin", role: "admin", added_at: T },
    { telegram_id: "2", name: "Staff", role: "staff", added_at: T },
  ],
  updated_at: T,
};

function service(): { svc: UsersService; fake: FakeS3 } {
  const fake = new FakeS3({ [USERS_KEY]: JSON.stringify(seeded) });
  const svc = new UsersService(fake as unknown as S3Client, BUCKET, () => T);
  return { svc, fake };
}

describe("UsersService", () => {
  it("find/list only work after refresh loads the cache", async () => {
    const { svc } = service();
    expect(svc.find("1")).toBeUndefined();
    expect(svc.list()).toEqual([]);

    await svc.refresh();
    expect(svc.find("1")?.role).toBe("admin");
    expect(svc.list()).toHaveLength(2);
  });

  it("add persists a new user and updates the cache", async () => {
    const { svc, fake } = service();
    await svc.refresh();

    const added = await svc.add({
      telegramId: "3",
      name: "Новенький",
      role: "staff",
    });
    expect(added.added_at).toBe(T);
    expect(svc.find("3")?.name).toBe("Новенький");

    const persisted = JSON.parse(fake.raw(USERS_KEY)!.body) as UsersFile;
    expect(persisted.users).toHaveLength(3);
  });

  it("add rejects a duplicate telegram_id", async () => {
    const { svc } = service();
    await svc.refresh();
    await expect(
      svc.add({ telegramId: "1", name: "Dup", role: "admin" }),
    ).rejects.toBeInstanceOf(UserExistsError);
  });

  it("remove deletes an existing user and reports true", async () => {
    const { svc, fake } = service();
    await svc.refresh();

    expect(await svc.remove("2")).toBe(true);
    expect(svc.find("2")).toBeUndefined();
    const persisted = JSON.parse(fake.raw(USERS_KEY)!.body) as UsersFile;
    expect(persisted.users).toHaveLength(1);
  });

  it("remove reports false for an unknown user", async () => {
    const { svc } = service();
    await svc.refresh();
    expect(await svc.remove("999")).toBe(false);
  });
});

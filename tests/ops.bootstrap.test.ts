import { describe, expect, it } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import {
  bootstrap,
  ensureBucket,
  seedAdminIfAbsent,
  BucketUnavailableError,
} from "../src/ops/bootstrap.js";
import { readUsers, USERS_KEY } from "../src/ops/users.js";
import { FakeS3 } from "./helpers/fakeS3.js";

const BUCKET = "ops-test";
const FIXED_TIME = "2026-06-20T00:00:00.000Z";
const admin = { telegramId: "42", name: "Boss" };

function asClient(fake: FakeS3): S3Client {
  return fake as unknown as S3Client;
}

describe("ops/bootstrap", () => {
  it("seeds users.json with the admin on first boot", async () => {
    const fake = new FakeS3();
    const result = await seedAdminIfAbsent(
      asClient(fake),
      BUCKET,
      admin,
      () => FIXED_TIME,
    );
    expect(result).toBe("created");

    const { data } = await readUsers(asClient(fake), BUCKET);
    expect(data.users).toEqual([
      {
        telegram_id: "42",
        name: "Boss",
        role: "admin",
        added_at: FIXED_TIME,
      },
    ]);
  });

  it("defaults the admin name when none is given", async () => {
    const fake = new FakeS3();
    await seedAdminIfAbsent(
      asClient(fake),
      BUCKET,
      { telegramId: "42" },
      () => FIXED_TIME,
    );
    const { data } = await readUsers(asClient(fake), BUCKET);
    expect(data.users[0]?.name).toBe("admin");
  });

  it("does not overwrite an existing users.json on second boot", async () => {
    const fake = new FakeS3();
    await seedAdminIfAbsent(asClient(fake), BUCKET, admin, () => FIXED_TIME);
    const firstEtag = fake.raw(USERS_KEY)?.etag;

    const second = await seedAdminIfAbsent(
      asClient(fake),
      BUCKET,
      { telegramId: "999", name: "Impostor" },
      () => "2099-01-01T00:00:00.000Z",
    );
    expect(second).toBe("exists");
    expect(fake.raw(USERS_KEY)?.etag).toBe(firstEtag);

    const { data } = await readUsers(asClient(fake), BUCKET);
    expect(data.users).toHaveLength(1);
    expect(data.users[0]?.telegram_id).toBe("42");
  });

  it("ensureBucket throws BucketUnavailableError when HeadBucket fails", async () => {
    const broken: Pick<S3Client, "send"> = {
      send: (() =>
        Promise.reject(new Error("network down"))) as S3Client["send"],
    };
    await expect(
      ensureBucket(broken as S3Client, BUCKET),
    ).rejects.toBeInstanceOf(BucketUnavailableError);
  });

  it("bootstrap checks the bucket then seeds the admin", async () => {
    const fake = new FakeS3();
    const config = {
      tigris: { bucket: BUCKET },
      admin: { telegramId: "42", name: "Boss" },
    } as unknown as Parameters<typeof bootstrap>[1];

    await bootstrap(asClient(fake), config, () => FIXED_TIME);

    const { data } = await readUsers(asClient(fake), BUCKET);
    expect(data.users[0]?.telegram_id).toBe("42");
  });
});

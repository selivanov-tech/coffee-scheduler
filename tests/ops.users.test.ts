import { describe, expect, it } from "vitest";
import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import {
  readUsers,
  putUsers,
  updateUsers,
  UsersConflictError,
  UsersNotFoundError,
  USERS_KEY,
  type UsersFile,
} from "../src/ops/users.js";
import { FakeS3 } from "./helpers/fakeS3.js";

const BUCKET = "ops-test";
const FIXED_TIME = "2026-06-20T00:00:00.000Z";

const adminOnly: UsersFile = {
  users: [
    { telegram_id: "1", name: "Admin", role: "admin", added_at: FIXED_TIME },
  ],
  updated_at: FIXED_TIME,
};

function seed(users: UsersFile): FakeS3 {
  return new FakeS3({ [USERS_KEY]: JSON.stringify(users) });
}

// FakeS3 implements only the .send surface ops/users.ts uses.
function asClient(fake: FakeS3): S3Client {
  return fake as unknown as S3Client;
}

describe("ops/users", () => {
  it("reads a valid users.json and returns its etag", async () => {
    const fake = seed(adminOnly);
    const { data, etag } = await readUsers(asClient(fake), BUCKET);
    expect(data.users).toHaveLength(1);
    expect(data.users[0]?.role).toBe("admin");
    expect(etag).toBe(fake.raw(USERS_KEY)?.etag);
  });

  it("throws UsersNotFoundError when the object is missing", async () => {
    const fake = new FakeS3();
    await expect(readUsers(asClient(fake), BUCKET)).rejects.toBeInstanceOf(
      UsersNotFoundError,
    );
  });

  it("rejects a malformed users.json", async () => {
    const fake = new FakeS3({ [USERS_KEY]: '{"users":[{"role":"boss"}]}' });
    await expect(readUsers(asClient(fake), BUCKET)).rejects.toThrow();
  });

  it("conditional put succeeds with the current etag", async () => {
    const fake = seed(adminOnly);
    const { etag } = await readUsers(asClient(fake), BUCKET);
    const newEtag = await putUsers(asClient(fake), BUCKET, adminOnly, etag);
    expect(newEtag).toBe(fake.raw(USERS_KEY)?.etag);
    expect(newEtag).not.toBe(etag);
  });

  it("conditional put with a stale etag throws UsersConflictError", async () => {
    const fake = seed(adminOnly);
    await expect(
      putUsers(asClient(fake), BUCKET, adminOnly, '"stale"'),
    ).rejects.toBeInstanceOf(UsersConflictError);
  });

  it("updateUsers applies the mutation and stamps updated_at", async () => {
    const fake = seed(adminOnly);
    const result = await updateUsers(
      asClient(fake),
      BUCKET,
      (current) => ({
        ...current,
        users: [
          ...current.users,
          { telegram_id: "2", name: "Staff", role: "staff", added_at: "x" },
        ],
      }),
      { now: () => FIXED_TIME },
    );
    expect(result.users).toHaveLength(2);
    expect(result.updated_at).toBe(FIXED_TIME);
    const persisted = JSON.parse(fake.raw(USERS_KEY)!.body) as UsersFile;
    expect(persisted.users).toHaveLength(2);
  });

  it("updateUsers retries after a concurrent writer bumps the etag", async () => {
    const fake = seed(adminOnly);
    let firstPut = true;
    const racing: Pick<S3Client, "send"> = {
      send: (async (command: unknown) => {
        if (command instanceof PutObjectCommand && firstPut) {
          firstPut = false;
          const { etag } = await readUsers(asClient(fake), BUCKET);
          await putUsers(asClient(fake), BUCKET, adminOnly, etag);
        }
        return fake.send(command);
      }) as S3Client["send"],
    };

    const result = await updateUsers(
      racing as S3Client,
      BUCKET,
      (current) => current,
      { now: () => FIXED_TIME, retries: 2 },
    );

    expect(result.updated_at).toBe(FIXED_TIME);
    expect(firstPut).toBe(false);
  });
});

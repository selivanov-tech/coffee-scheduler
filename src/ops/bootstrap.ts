import { HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3";
import type { Config } from "../config.js";
import { createUsersIfAbsent, type UsersFile } from "./users.js";

export class BucketUnavailableError extends Error {
  constructor(bucket: string, options?: { cause?: unknown }) {
    super(`ops bucket "${bucket}" is not reachable`, options);
    this.name = "BucketUnavailableError";
  }
}

export interface AdminSeed {
  telegramId: string;
  name?: string;
}

export async function ensureBucket(
  s3: S3Client,
  bucket: string,
): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    throw new BucketUnavailableError(bucket, { cause: err });
  }
}

export async function seedAdminIfAbsent(
  s3: S3Client,
  bucket: string,
  admin: AdminSeed,
  now: () => string = () => new Date().toISOString(),
): Promise<"created" | "exists"> {
  const stamp = now();
  const data: UsersFile = {
    users: [
      {
        telegram_id: admin.telegramId,
        name: admin.name ?? "admin",
        role: "admin",
        added_at: stamp,
      },
    ],
    updated_at: stamp,
  };
  return createUsersIfAbsent(s3, bucket, data);
}

export async function bootstrap(
  s3: S3Client,
  config: Config,
  now?: () => string,
): Promise<void> {
  await ensureBucket(s3, config.tigris.bucket);
  const result = await seedAdminIfAbsent(
    s3,
    config.tigris.bucket,
    { telegramId: config.admin.telegramId, name: config.admin.name },
    now,
  );
  console.log(
    result === "created"
      ? "bootstrap: seeded users.json with admin"
      : "bootstrap: users.json already present",
  );
}

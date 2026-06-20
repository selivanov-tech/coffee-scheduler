import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

export const USERS_KEY = "users.json";

const userRecordSchema = z.object({
  telegram_id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["admin", "staff"]),
  added_at: z.string().min(1),
});

const usersFileSchema = z.object({
  users: z.array(userRecordSchema),
  updated_at: z.string().min(1),
});

export type UserRole = UserRecord["role"];
export type UserRecord = z.infer<typeof userRecordSchema>;
export type UsersFile = z.infer<typeof usersFileSchema>;

export interface UsersSnapshot {
  data: UsersFile;
  etag: string;
}

export class UsersNotFoundError extends Error {
  constructor() {
    super(`${USERS_KEY} does not exist`);
    this.name = "UsersNotFoundError";
  }
}

export class UsersConflictError extends Error {
  constructor() {
    super(`${USERS_KEY} changed during write`);
    this.name = "UsersConflictError";
  }
}

export async function readUsers(
  s3: S3Client,
  bucket: string,
  key: string = USERS_KEY,
): Promise<UsersSnapshot> {
  let res;
  try {
    res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    if (isNotFound(err)) throw new UsersNotFoundError();
    throw err;
  }
  const raw = await res.Body?.transformToString();
  if (!raw) throw new Error(`${key} is empty`);
  if (!res.ETag) throw new Error(`${key} has no ETag`);
  return { data: usersFileSchema.parse(JSON.parse(raw)), etag: res.ETag };
}

export async function putUsers(
  s3: S3Client,
  bucket: string,
  data: UsersFile,
  etag: string,
  key: string = USERS_KEY,
): Promise<string> {
  try {
    const res = await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: serialize(data),
        ContentType: "application/json",
        IfMatch: etag,
      }),
    );
    if (!res.ETag) throw new Error(`${key} write returned no ETag`);
    return res.ETag;
  } catch (err) {
    if (isPreconditionFailed(err)) throw new UsersConflictError();
    throw err;
  }
}

export async function updateUsers(
  s3: S3Client,
  bucket: string,
  mutate: (current: UsersFile) => UsersFile,
  opts: { key?: string; retries?: number; now?: () => string } = {},
): Promise<UsersFile> {
  const key = opts.key ?? USERS_KEY;
  const retries = opts.retries ?? 3;
  const now = opts.now ?? (() => new Date().toISOString());

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, etag } = await readUsers(s3, bucket, key);
    const next: UsersFile = { ...mutate(data), updated_at: now() };
    try {
      await putUsers(s3, bucket, next, etag, key);
      return next;
    } catch (err) {
      if (err instanceof UsersConflictError && attempt < retries) continue;
      throw err;
    }
  }
  throw new UsersConflictError();
}

function serialize(data: UsersFile): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function httpStatus(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
}

function errName(err: unknown): string | undefined {
  return (err as { name?: string })?.name;
}

function isNotFound(err: unknown): boolean {
  return httpStatus(err) === 404 || errName(err) === "NoSuchKey";
}

function isPreconditionFailed(err: unknown): boolean {
  return httpStatus(err) === 412 || errName(err) === "PreconditionFailed";
}

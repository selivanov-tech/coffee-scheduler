import type { S3Client } from "@aws-sdk/client-s3";
import {
  readUsers,
  updateUsers,
  type UserRecord,
  type UserRole,
  type UsersFile,
} from "./users.js";

export class UserExistsError extends Error {
  constructor(telegramId: string) {
    super(`user ${telegramId} already exists`);
    this.name = "UserExistsError";
  }
}

export interface NewUser {
  telegramId: string;
  name: string;
  role: UserRole;
}

export class UsersService {
  private cache: UsersFile | undefined;

  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async refresh(): Promise<UsersFile> {
    const { data } = await readUsers(this.s3, this.bucket);
    this.cache = data;
    return data;
  }

  find(telegramId: string): UserRecord | undefined {
    return this.cache?.users.find((u) => u.telegram_id === telegramId);
  }

  list(): UserRecord[] {
    return this.cache ? [...this.cache.users] : [];
  }

  async add(user: NewUser): Promise<UserRecord> {
    const record: UserRecord = {
      telegram_id: user.telegramId,
      name: user.name,
      role: user.role,
      added_at: this.now(),
    };
    this.cache = await updateUsers(
      this.s3,
      this.bucket,
      (current) => {
        if (current.users.some((u) => u.telegram_id === record.telegram_id)) {
          throw new UserExistsError(record.telegram_id);
        }
        return { ...current, users: [...current.users, record] };
      },
      { now: this.now },
    );
    return record;
  }

  async remove(telegramId: string): Promise<boolean> {
    let removed = false;
    this.cache = await updateUsers(
      this.s3,
      this.bucket,
      (current) => {
        const users = current.users.filter((u) => u.telegram_id !== telegramId);
        removed = users.length !== current.users.length;
        return { ...current, users };
      },
      { now: this.now },
    );
    return removed;
  }
}

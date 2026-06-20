import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

interface StoredObject {
  body: string;
  etag: string;
}

class S3FakeError extends Error {
  readonly $metadata: { httpStatusCode: number };
  constructor(name: string, status: number) {
    super(name);
    this.name = name;
    this.$metadata = { httpStatusCode: status };
  }
}

// Minimal in-memory stand-in for S3Client.send for GetObject/PutObject,
// faithful to the bits ops/users.ts relies on: ETags and the
// If-Match / If-None-Match preconditions (412 on mismatch).
export class FakeS3 {
  private readonly store = new Map<string, StoredObject>();
  private seq = 0;

  constructor(initial: Record<string, string> = {}) {
    for (const [key, body] of Object.entries(initial)) {
      this.store.set(key, { body, etag: this.nextEtag() });
    }
  }

  send(command: unknown): Promise<unknown> {
    if (command instanceof GetObjectCommand) return this.get(command.input);
    if (command instanceof PutObjectCommand) return this.put(command.input);
    return Promise.reject(new Error("FakeS3: unsupported command"));
  }

  raw(key: string): StoredObject | undefined {
    return this.store.get(key);
  }

  private async get(input: {
    Key?: string;
  }): Promise<{
    ETag: string;
    Body: { transformToString(): Promise<string> };
  }> {
    const obj = this.store.get(input.Key ?? "");
    if (!obj) throw new S3FakeError("NoSuchKey", 404);
    return {
      ETag: obj.etag,
      Body: { transformToString: () => Promise.resolve(obj.body) },
    };
  }

  private async put(input: {
    Key?: string;
    Body?: unknown;
    IfMatch?: string;
    IfNoneMatch?: string;
  }): Promise<{ ETag: string }> {
    const key = input.Key ?? "";
    const existing = this.store.get(key);

    if (input.IfNoneMatch === "*" && existing) {
      throw new S3FakeError("PreconditionFailed", 412);
    }
    if (input.IfMatch !== undefined) {
      if (!existing || existing.etag !== input.IfMatch) {
        throw new S3FakeError("PreconditionFailed", 412);
      }
    }

    const etag = this.nextEtag();
    this.store.set(key, { body: String(input.Body ?? ""), etag });
    return { ETag: etag };
  }

  private nextEtag(): string {
    this.seq += 1;
    return `"etag-${this.seq}"`;
  }
}

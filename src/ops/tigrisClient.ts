import { S3Client } from "@aws-sdk/client-s3";
import type { Config } from "../config.js";

export function createTigrisClient(tigris: Config["tigris"]): S3Client {
  return new S3Client({
    endpoint: tigris.endpoint,
    region: tigris.region,
    credentials: {
      accessKeyId: tigris.accessKeyId,
      secretAccessKey: tigris.secretAccessKey,
    },
  });
}

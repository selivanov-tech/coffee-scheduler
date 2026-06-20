import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config.js";

const fullEnv: Record<string, string> = {
  BOT_TOKEN: "000000:example-token",
  TELEGRAM_WEBHOOK_SECRET: "example-webhook-secret",
  AI_PROVIDER: "anthropic",
  AI_MODEL: "claude-sonnet-4-5",
  ANTHROPIC_API_KEY: "sk-ant-example",
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: "bot@example.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
  }),
  SCHEDULE_SPREADSHEET_ID: "example-spreadsheet-id",
  ADMIN_TELEGRAM_ID: "000000000",
  AWS_ACCESS_KEY_ID: "tid_example",
  AWS_SECRET_ACCESS_KEY: "tsec_example",
  AWS_ENDPOINT_URL_S3: "https://t3.storage.dev",
  AWS_REGION: "auto",
  OPS_BUCKET: "example-ops-bucket",
  NODE_ENV: "test",
  PUBLIC_URL: "https://example.fly.dev",
};

describe("parseConfig", () => {
  it("accepts a complete environment and applies defaults", () => {
    const cfg = parseConfig(fullEnv);
    expect(cfg.ai.provider).toBe("anthropic");
    expect(cfg.google.serviceAccount.client_email).toContain("@");
    expect(cfg.server.port).toBe(8080); // default
    expect(cfg.caps.webhookTimeoutMs).toBeGreaterThan(cfg.caps.agentTurnDeadlineMs);
  });

  it("fails when a required secret is missing", () => {
    const { BOT_TOKEN, ...rest } = fullEnv;
    expect(() => parseConfig(rest)).toThrow();
  });

  it("requires ANTHROPIC_API_KEY when provider is anthropic", () => {
    const { ANTHROPIC_API_KEY, ...rest } = fullEnv;
    expect(() => parseConfig(rest)).toThrow();
  });

  it("rejects an invalid service-account JSON string", () => {
    expect(() => parseConfig({ ...fullEnv, GOOGLE_SERVICE_ACCOUNT_JSON: "not-json" })).toThrow();
  });

  it("rejects a turn deadline that is not below the webhook timeout", () => {
    expect(() =>
      parseConfig({ ...fullEnv, AGENT_TURN_DEADLINE_MS: "30000", WEBHOOK_TIMEOUT_MS: "30000" }),
    ).toThrow();
  });
});

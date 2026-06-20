import { z } from "zod";

const serviceAccountSchema = z
  .object({
    client_email: z.string().email(),
    private_key: z.string().min(1),
  })
  .passthrough();

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

const envSchema = z
  .object({
    // --- Telegram ---
    BOT_TOKEN: z.string().min(1),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(1),

    // --- AI provider ---
    AI_PROVIDER: z.enum(["anthropic"]).default("anthropic"),
    AI_MODEL: z.string().min(1).default("claude-sonnet-4-5"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),

    // --- Google Sheets ---
    GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
    SCHEDULE_SPREADSHEET_ID: z.string().min(1),

    // --- Admin / users ---
    ADMIN_TELEGRAM_ID: z.string().min(1),
    ADMIN_NAME: z.string().min(1).optional(),

    // --- Tigris (S3-compatible ops storage) ---
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_ENDPOINT_URL_S3: z.string().url(),
    AWS_REGION: z.string().min(1),
    OPS_BUCKET: z.string().min(1),

    // --- Runtime ---
    NODE_ENV: z
      .enum(["production", "development", "test"])
      .default("production"),
    PUBLIC_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().default(8080),
    SHOP_TIMEZONE: z.string().min(1).default("Asia/Almaty"),

    // --- Hard caps ---
    PENDING_PROPOSAL_TTL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    MAX_TOOL_ITERS: z.coerce.number().int().positive().default(6),
    TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    AGENT_TURN_DEADLINE_MS: z.coerce.number().int().positive().default(25_000),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ANTHROPIC_API_KEY"],
        message: "required when AI_PROVIDER=anthropic",
      });
    }
    if (env.AGENT_TURN_DEADLINE_MS >= env.WEBHOOK_TIMEOUT_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AGENT_TURN_DEADLINE_MS"],
        message:
          "must be < WEBHOOK_TIMEOUT_MS (the reply must come before the webhook timeout)",
      });
    }
  });

export interface Config {
  nodeEnv: "production" | "development" | "test";
  telegram: { botToken: string; webhookSecret: string };
  ai: { provider: "anthropic"; model: string; anthropicApiKey?: string };
  google: { serviceAccount: ServiceAccount; spreadsheetId: string };
  admin: { telegramId: string; name?: string };
  tigris: {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    region: string;
    bucket: string;
  };
  server: { port: number; publicUrl: string; timezone: string };
  caps: {
    pendingProposalTtlMinutes: number;
    maxToolIters: number;
    toolTimeoutMs: number;
    agentTurnDeadlineMs: number;
    webhookTimeoutMs: number;
  };
}

function parseServiceAccount(raw: string): ServiceAccount {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  return serviceAccountSchema.parse(json);
}

export function parseConfig(
  env: NodeJS.ProcessEnv | Record<string, unknown>,
): Config {
  const e = envSchema.parse(env);
  return {
    nodeEnv: e.NODE_ENV,
    telegram: {
      botToken: e.BOT_TOKEN,
      webhookSecret: e.TELEGRAM_WEBHOOK_SECRET,
    },
    ai: {
      provider: e.AI_PROVIDER,
      model: e.AI_MODEL,
      anthropicApiKey: e.ANTHROPIC_API_KEY,
    },
    google: {
      serviceAccount: parseServiceAccount(e.GOOGLE_SERVICE_ACCOUNT_JSON),
      spreadsheetId: e.SCHEDULE_SPREADSHEET_ID,
    },
    admin: { telegramId: e.ADMIN_TELEGRAM_ID, name: e.ADMIN_NAME },
    tigris: {
      accessKeyId: e.AWS_ACCESS_KEY_ID,
      secretAccessKey: e.AWS_SECRET_ACCESS_KEY,
      endpoint: e.AWS_ENDPOINT_URL_S3,
      region: e.AWS_REGION,
      bucket: e.OPS_BUCKET,
    },
    server: {
      port: e.PORT,
      publicUrl: e.PUBLIC_URL,
      timezone: e.SHOP_TIMEZONE,
    },
    caps: {
      pendingProposalTtlMinutes: e.PENDING_PROPOSAL_TTL_MINUTES,
      maxToolIters: e.MAX_TOOL_ITERS,
      toolTimeoutMs: e.TOOL_TIMEOUT_MS,
      agentTurnDeadlineMs: e.AGENT_TURN_DEADLINE_MS,
      webhookTimeoutMs: e.WEBHOOK_TIMEOUT_MS,
    },
  };
}

export function loadConfig(): Config {
  try {
    return parseConfig(process.env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("❌ Invalid configuration:");
      for (const issue of err.issues) {
        console.error(
          `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
        );
      }
    } else {
      console.error(`❌ Invalid configuration: ${(err as Error).message}`);
    }
    process.exit(1);
  }
}

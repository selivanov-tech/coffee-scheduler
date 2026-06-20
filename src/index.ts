import { createBot } from "./bot/bot.js";
import { createWebhookHandler } from "./bot/webhook.js";
import { loadConfig } from "./config.js";
import { createServer } from "./http/server.js";
import { installLifecycle } from "./lifecycle.js";
import { bootstrap } from "./ops/bootstrap.js";
import { createTigrisClient } from "./ops/tigrisClient.js";
import { UsersService } from "./ops/usersService.js";

const config = loadConfig();
const tigris = createTigrisClient(config.tigris);

try {
  await bootstrap(tigris, config);
} catch (err) {
  console.error("bootstrap failed:", err);
  process.exit(1);
}

const users = new UsersService(tigris, config.tigris.bucket);
await users.refresh();

const bot = createBot({ token: config.telegram.botToken, users });
const onWebhook = createWebhookHandler(bot, {
  secretToken: config.telegram.webhookSecret,
  timeoutMs: config.caps.webhookTimeoutMs,
});

const server = createServer({ onWebhook });
installLifecycle(server, { timeoutMs: config.caps.webhookTimeoutMs });

server.listen(config.server.port, async () => {
  await bot.init();
  await bot.api.setWebhook(`${config.server.publicUrl}/webhook`, {
    secret_token: config.telegram.webhookSecret,
    allowed_updates: ["message", "callback_query"],
  });
  console.log(
    `listening on :${config.server.port} as @${bot.botInfo.username} — env=${config.nodeEnv}`,
  );
});

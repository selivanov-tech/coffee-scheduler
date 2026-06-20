import { loadConfig } from "./config.js";
import { createServer } from "./http/server.js";
import { bootstrap } from "./ops/bootstrap.js";
import { createTigrisClient } from "./ops/tigrisClient.js";

const config = loadConfig();
const tigris = createTigrisClient(config.tigris);

try {
  await bootstrap(tigris, config);
} catch (err) {
  console.error("bootstrap failed:", err);
  process.exit(1);
}

const server = createServer();

server.listen(config.server.port, () => {
  console.log(
    `listening on :${config.server.port} — env=${config.nodeEnv}, provider=${config.ai.provider}, model=${config.ai.model}`,
  );
});

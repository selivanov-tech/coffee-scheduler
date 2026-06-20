import { loadConfig } from "./config.js";
import { createServer } from "./http/server.js";

const config = loadConfig();
const server = createServer();

server.listen(config.server.port, () => {
  console.log(
    `listening on :${config.server.port} — env=${config.nodeEnv}, provider=${config.ai.provider}, model=${config.ai.model}`,
  );
});

import { loadConfig } from "./config.js";

const config = loadConfig();
console.log(
  `✅ config loaded — env=${config.nodeEnv}, provider=${config.ai.provider}, model=${config.ai.model}, port=${config.server.port}`,
);

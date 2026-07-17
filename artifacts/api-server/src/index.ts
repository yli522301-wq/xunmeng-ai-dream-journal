import app from "./app";
import { logger } from "./lib/logger";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxyUrl = process.env["HTTPS_PROXY"] || process.env["HTTP_PROXY"] || process.env["ALL_PROXY"];
if (proxyUrl) {
  try {
    const agent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(agent);
    logger.info(
      { proxy: new URL(proxyUrl).origin, proxyUrlScheme: new URL(proxyUrl).protocol },
      "HTTP proxy enabled — all outbound fetch requests (including OpenAI Realtime) will route through proxy",
    );
  } catch (err) {
    logger.warn({ err, proxyUrl: String(proxyUrl) }, "Failed to configure proxy agent — outbound requests will go direct");
  }
} else {
  logger.info("No HTTP(S)_PROXY / ALL_PROXY set — outbound requests will go direct");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

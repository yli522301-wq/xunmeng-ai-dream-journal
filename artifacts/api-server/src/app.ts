import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { existsSync } from "fs";

const app: Express = express();

// Trust exactly one upstream proxy hop (Replit's edge proxy).
// This makes req.ip reflect the real client IP that the proxy recorded,
// instead of the proxy's own socket address, while still ignoring any
// X-Forwarded-For values that a client could have injected before the
// trusted proxy's hop.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Raise body limit to accommodate base64 image data URLs sent from the browser
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

app.use("/api", router);

// Temporary: serve voice comparison test page
const VOICE_TEST_DIR = "/home/runner/workspace/artifacts/xun-meng/public/voice-test";
if (existsSync(VOICE_TEST_DIR)) {
  app.use("/api/voice-test", express.static(VOICE_TEST_DIR, { index: "index.html" }));
}

export default app;

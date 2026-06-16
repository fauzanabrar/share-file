import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { config } from "./shared/config.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";

export function createApp() {
  const app = express();
  const clientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../client/dist",
  );

  const corsOptions = config.allowAllOrigins
    ? { origin: true }
    : { origin: config.clientOrigins };

  app.use(cors(corsOptions));
  app.use(express.json());

  registerHealthRoutes(app);

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (_request, response, next) => {
      if (_request.path.startsWith("/api") || _request.path.startsWith("/ws")) {
        next();
        return;
      }

      response.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}

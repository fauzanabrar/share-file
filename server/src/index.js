import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./shared/config.js";
import { registerSocketGateway } from "./socketGateway.js";

const app = createApp();
const httpServer = createServer(app);

registerSocketGateway(httpServer);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Signaling server listening on http://0.0.0.0:${config.port}`);
});

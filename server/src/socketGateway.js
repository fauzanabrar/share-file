import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { handleRoomMessage } from "./modules/rooms/roomHandlers.js";
import { RoomStore } from "./modules/rooms/roomStore.js";
import { handleSignalMessage } from "./modules/signaling/signalingHandlers.js";

const roomStore = new RoomStore();
const clients = new Map();

export function registerSocketGateway(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    const client = { id: randomUUID(), ws };
    clients.set(client.id, client);

    ws.on("message", (rawMessage) => {
      const message = parseMessage(rawMessage);
      if (!message) {
        return;
      }

      const context = {
        client,
        clients,
        roomStore,
        reply: (payload) => reply(client, message.requestId, payload),
        sendEvent,
      };

      if (message.event.startsWith("room:")) {
        handleRoomMessage(context, message.event, message.payload);
        return;
      }

      if (message.event.startsWith("signal:")) {
        handleSignalMessage(context, message.event, message.payload);
      }
    });

    ws.on("close", () => {
      const roomCode = roomStore.leave(client.id);
      clients.delete(client.id);
      if (roomCode) {
        broadcastToRoom(roomCode, client.id, "room:peer-left", { peerId: client.id });
      }
    });
  });
}

function parseMessage(rawMessage) {
  try {
    const message = JSON.parse(rawMessage.toString());
    if (!message?.event) {
      return null;
    }
    return message;
  } catch {
    return null;
  }
}

function reply(client, requestId, payload) {
  if (!requestId || client.ws.readyState !== WebSocket.OPEN) {
    return;
  }

  client.ws.send(JSON.stringify({ requestId, payload }));
}

function sendEvent(clientId, event, payload) {
  const target = clients.get(clientId);
  if (!target || target.ws.readyState !== WebSocket.OPEN) {
    return;
  }

  target.ws.send(JSON.stringify({ event, payload }));
}

function broadcastToRoom(roomCode, exceptClientId, event, payload) {
  for (const peerId of roomStore.getPeers(roomCode, exceptClientId)) {
    sendEvent(peerId, event, payload);
  }
}

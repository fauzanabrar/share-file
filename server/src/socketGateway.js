import { randomUUID } from "node:crypto";
import os from "node:os";
import { WebSocket, WebSocketServer } from "ws";
import { handlePeerMessage } from "./modules/peers/peerHandlers.js";
import { handleSignalMessage } from "./modules/signaling/signalingHandlers.js";

const clients = new Map();

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    // Ignore virtual/VM/VPN/WSL/Tailscale adapters to prevent resolving to unreachable internal IPs
    if (/virtual|vmware|vbox|wsl|tailscale|vpn/i.test(name)) {
      continue;
    }
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidates.push(iface.address);
      }
    }
  }
  const lanIp = candidates.find((ip) => {
    return (
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      (ip.startsWith("172.") &&
        Number(ip.split(".")[1]) >= 16 &&
        Number(ip.split(".")[1]) <= 31)
    );
  });
  return lanIp || candidates[0] || "127.0.0.1";
}

export function registerSocketGateway(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, request) => {
    const rawIp = request.headers["x-forwarded-for"]
      ? request.headers["x-forwarded-for"].split(",")[0].trim()
      : request.socket?.remoteAddress || "";

    let clientIp = rawIp;
    if (clientIp.startsWith("::ffff:")) {
      clientIp = clientIp.substring(7);
    } else if (clientIp === "::1") {
      clientIp = "127.0.0.1";
    }

    if (clientIp === "127.0.0.1" || !clientIp) {
      clientIp = getLocalIpAddress();
    }

    const client = {
      id: randomUUID(),
      ws,
      displayName: "LAN device",
      ip: clientIp,
    };
    clients.set(client.id, client);

    ws.on("message", (rawMessage) => {
      const message = parseMessage(rawMessage);
      if (!message) {
        return;
      }

      const context = {
        client,
        clients,
        reply: (payload) => reply(client, message.requestId, payload),
        sendEvent,
        serializePeer: (peer) => serializePeer(peer),
        broadcastPeerLists,
      };

      if (message.event.startsWith("peer:")) {
        handlePeerMessage(context, message.event, message.payload);
        return;
      }

      if (message.event.startsWith("signal:")) {
        handleSignalMessage(context, message.event, message.payload);
      }
    });

    ws.on("close", () => {
      clients.delete(client.id);
      broadcastPeerLists();
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

function broadcastPeerLists() {
  for (const client of clients.values()) {
    sendEvent(client.id, "peer:list", {
      self: serializePeer(client),
      peers: [...clients.values()]
        .filter((peer) => peer.id !== client.id)
        .map((peer) => serializePeer(peer)),
    });
  }
}

function serializePeer(peer) {
  return {
    id: peer.id,
    displayName: peer.displayName || "LAN device",
  };
}

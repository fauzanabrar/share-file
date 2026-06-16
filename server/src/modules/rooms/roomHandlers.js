import { normalizeRoomCode } from "./roomStore.js";

export function handleRoomMessage(context, event, payload = {}) {
  if (event === "room:create") {
    try {
      const room = context.roomStore.create(context.client.id);
      context.reply({
        ok: true,
        roomCode: room.roomCode,
        peerId: context.client.id,
        peers: [],
      });
    } catch (error) {
      context.reply({ ok: false, error: error.message });
    }
    return;
  }

  if (event === "room:join") {
    const { roomCode } = payload;
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const result = context.roomStore.join(normalizedRoomCode, context.client.id);

    if (!result.ok) {
      context.reply(result);
      return;
    }

    context.reply({
      ok: true,
      roomCode: normalizedRoomCode,
      peerId: context.client.id,
      peers: result.existingPeers,
    });

    for (const peerId of result.existingPeers) {
      context.sendEvent(peerId, "room:peer-joined", { peerId: context.client.id });
    }
    return;
  }

  if (event === "room:ready") {
    const { roomCode } = payload;
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    for (const peerId of context.roomStore.getPeers(normalizedRoomCode, context.client.id)) {
      context.sendEvent(peerId, "room:peer-ready", { peerId: context.client.id });
    }
    return;
  }

  if (event === "room:leave") {
    const roomCode = context.roomStore.leave(context.client.id);
    if (roomCode) {
      for (const peerId of context.roomStore.getPeers(roomCode, context.client.id)) {
        context.sendEvent(peerId, "room:peer-left", { peerId: context.client.id });
      }
    }
  }
}

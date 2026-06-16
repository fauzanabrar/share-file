const DEFAULT_DEVICE_NAME = "LAN device";

export function handlePeerMessage(context, event, payload = {}) {
  if (event === "peer:announce") {
    context.client.displayName = normalizeDisplayName(payload.displayName);
    context.reply({ ok: true, peer: context.serializePeer(context.client) });
    context.broadcastPeerLists();
  }
}

function normalizeDisplayName(value) {
  const name = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) {
    return DEFAULT_DEVICE_NAME;
  }

  return name.slice(0, 40);
}

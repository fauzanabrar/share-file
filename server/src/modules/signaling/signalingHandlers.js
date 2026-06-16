export function handleSignalMessage(context, event, payload = {}) {
  if (event !== "signal:send") {
    return;
  }

  if (!payload.targetId || !payload.payload) {
    return;
  }

  context.sendEvent(payload.targetId, "signal:receive", {
    from: context.client.id,
    payload: payload.payload,
    senderIp: context.client.ip,
  });
}

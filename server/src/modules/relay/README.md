# Relay Module

Handles WebSocket-based data relaying between clients when direct WebRTC P2P connections fail.

## Entry Points

- `relayHandlers.js` handles `relay:*` messages from the WebSocket gateway.

## Relay Protocol

The relay module routes chunks of binary data (base64-encoded) between matched clients to simulate a WebRTC DataChannel connection.

1. **Initialization:**
   - Initiator sends `relay:open` containing `{ targetId }`.
   - Server creates a pair mapping and forwards `relay:open` to the receiver.
2. **Acceptance:**
   - Receiver responds with `relay:accept` to confirm connection.
   - Server validates pair and forwards `relay:ready` back to both peers.
3. **Data Transit:**
   - Clients send data via `relay:data`. Server validates pairing and forwards to the corresponding peer.
4. **Teardown:**
   - Either side sends `relay:close`, or disconnects entirely. Server deletes the pair mapping and forwards `relay:close` to the peer.

## AI Context

The relay acts as a transparent proxy. Data chunks are not inspected or manipulated by the server. Pairings are tracked in a memory-local `Map`. In a multi-server/cluster deployment, these chunks would need to be routed via a pub-sub adapter.

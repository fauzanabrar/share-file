# Peers Module

Owns LAN user discovery and click-to-connect pairing.

## Entry Points

- `peerHandlers.js` handles `peer:*` messages from the WebSocket gateway.
- `socketGateway.js` stores connected clients, display names, and one active peer connection per client.

## WebSocket Events

- `peer:announce` registers the client's random username/device name and returns the local peer record.
- `peer:list` broadcasts visible LAN users to every connected client.
- `peer:connect` asks another user to connect.
- `peer:connect-request` is delivered to the target client.
- `peer:accept` marks both users connected and allows the requester to create the WebRTC offer.
- `peer:connect-accepted` notifies the requester that it should become the initiator.
- `peer:disconnect` clears the active pairing.

## Timing Note

The target client should emit `peer:accept` only after its WebRTC signaling listener is ready. That readiness is client-side state, but it matters because `peer:accept` lets the requester create and send the offer.

## AI Context

The peer directory is process-local. For multi-server deployment, replace the in-memory `clients` map with shared presence storage.

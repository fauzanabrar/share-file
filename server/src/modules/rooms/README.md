# Rooms Module

Owns temporary two-peer room lifecycle.

## Entry Points

- `roomStore.js` keeps in-memory room membership.
- `roomHandlers.js` handles room messages from the WebSocket gateway.

## WebSocket Events

- `room:create` returns a short room code and local socket ID.
- `room:join` joins an existing room if it has space.
- `room:ready` tells the host the joining peer is ready for WebRTC negotiation.
- `room:leave` and disconnect cleanup membership.

## AI Context

Rooms are ephemeral and process-local. For multi-instance deployment, replace `RoomStore` with Redis or another shared adapter and use the Socket.IO Redis adapter.

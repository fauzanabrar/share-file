# Server

Express + WebSocket signaling server for LAN peer discovery and WebRTC negotiation.

The server does not store, proxy, or inspect files. It tracks connected browsers by random username/device name and routes opaque signaling payloads between two sockets.

## Responsibilities

- Serve health checks from `/api/health`.
- Accept WebSocket clients on `/ws`.
- Maintain the in-memory LAN user directory.
- Route connect requests and disconnect notices.
- Relay opaque WebRTC offer, answer, and ICE candidate payloads.

## Non-Responsibilities

- No file storage.
- No file metadata parsing.
- No room-code state.
- No TURN relay.

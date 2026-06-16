# Signaling Module

Routes opaque WebRTC signaling payloads between connected clients.

## Entry Points

- `signalingHandlers.js` handles `signal:send` messages from the WebSocket gateway.

## Socket Events

- Client sends `signal:send` with `{ targetId, payload }`.
- Server forwards `{ from, payload, senderIp }` to `targetId` as `signal:receive`.

## Client IP Propagation (LAN WebRTC Support)

To help bypass mDNS obfuscation of local IP hostnames in non-secure HTTP contexts, the server attaches the client's detected IP address (`context.client.ip`) as `senderIp` on every relayed signaling message. 

The client uses this `senderIp` to dynamically rewrite unresolved `.local` candidate domains to direct LAN IP addresses, facilitating connection.

## AI Context

The server must not parse SDP, ICE candidates, or file metadata. Treat payloads as opaque envelopes and keep validation limited to routing fields. Client-side listeners may buffer early events, but the server should still route immediately.

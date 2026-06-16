# Peers Module

Owns LAN user discovery and directory list tracking.

## Entry Points

- `peerHandlers.js` handles `peer:*` messages from the WebSocket gateway.
- `socketGateway.js` stores connected client sockets, IPs, and display names.

## WebSocket Events

- `peer:announce` registers the client's random username/device name and returns the local peer record.
- `peer:list` broadcasts visible LAN users (including their display names and client IDs) to every connected client.

## Auto-Connection Model

Unlike traditional pairing protocols, there are no manual connect/disconnect handshakes on the signaling server. Once a client registers via `peer:announce`, the server broadcasts the peer list. The clients deterministically establish mutual WebRTC connections using lexicographical client ID comparisons.

## AI Context

The peer directory is process-local. For multi-server deployment, replace the in-memory `clients` map with shared presence storage.

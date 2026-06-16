# Signaling Module

Owns the browser WebSocket client connection to the signaling server.

## Entry Points

- `useSignalingSocket.js` creates a small event-emitter wrapper around the browser `WebSocket`.

## Protocol Boundary

This module should only manage transport connectivity and event dispatch. Peer discovery events belong in `pairing`, WebRTC offer/answer handling belongs in `peer`, and file metadata belongs in `transfer`.

## Event Buffering

Incoming events are buffered when no listener has been registered yet. When a listener is later added with `on(event, listener)`, queued payloads for that event are flushed with `queueMicrotask()`. This prevents early `signal:receive` or peer events from being lost during React mount/remount timing.

The queue is intentionally small and per event; it is not a persistent message store.

## AI Context

If changing server URLs, authentication, or WebSocket framing, start here. The wrapper intentionally exposes `emit`, `on`, and `off` so feature modules do not depend on raw WebSocket framing.

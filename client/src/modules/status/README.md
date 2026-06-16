# Status Module

Owns compact runtime status display for signaling, WebRTC, ICE, and DataChannel readiness.

## Entry Points

- `ConnectionStatus.jsx` maps low-level states to a user-facing badge.

## AI Context

Keep state labels factual. Do not infer whether traffic is relayed unless the peer module exposes selected candidate-pair details from `RTCPeerConnection.getStats()`.


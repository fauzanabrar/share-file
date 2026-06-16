# Peer Module

Owns browser-to-browser WebRTC setup.

## Entry Points

- `usePeerConnection.js` creates `RTCPeerConnection`, exchanges offers, answers, and ICE candidates through the signaling socket, and exposes the active `RTCDataChannel`.
- `peerConfig.js` stores ICE server configuration.

## Protocol Boundary

This module moves signaling envelopes only. It does not know peer-directory internals or file-transfer message schemas beyond forwarding received DataChannel messages to the transfer module.

## Readiness

`usePeerConnection()` exposes `signalingReady` after its `signal:receive` listener has been registered. The non-initiating side should not emit `peer:accept` until this is true; otherwise the initiator may send an offer before the receiver can process it.

The hook guards stale effect cleanup paths, so React remounts or peer resets do not keep sending candidates, updating state, or handling messages from a closed connection.

## Local Candidate & SDP Rewriting (LAN Support)

In non-secure HTTP contexts on a LAN, browsers hide local IPv4 candidates behind randomly generated `.local` mDNS hostnames. Since local routers and client devices cannot resolve these hostnames directly, WebRTC connections fail.

To resolve this:
- When receiving a signal message, the `usePeerConnection` hook extracts the `senderIp` sent by the signaling server.
- It scans the SDP and candidate descriptions for `*.local` hostnames and replaces them with the sender's actual IP address.
- In `onicecandidate`, the candidate is standardized using `.toJSON()` to prevent serialization issues across different browser versions.

## AI Context

For TURN relay, update `peerConfig.js`. For connection diagnostics, add `getStats()` polling here and expose selected candidate-pair type to the status module.

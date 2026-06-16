# Repository Guidelines

## Project Structure

This is a WebRTC file transfer app with a monorepo layout:
- `client/` — React + Vite browser app
- `server/` — Express + ws signaling server
- Both use ES modules (`"type": "module"`)

## File Transfer Protocol (transferProtocol.js)

The sender sends 256KB ArrayBuffer chunks over a WebRTC DataChannel. Control messages (JSON) are `file-meta`, `file-done`, `file-cancel`, `file-resume`. The receiver waits for user acceptance on `file-meta`; when File System Access is available it streams chunks directly to the selected file, otherwise it falls back to an in-memory buffer.

**File ID** is `${name}-${size}-${lastModified}` — stable across reloads for resume support.

**Resume**: sender persists `{ name, size, mimeType, lastSentOffset }` to `localStorage` every 4MB. On reconnect, receiver replies `file-resume` with its current received offset, sender resumes from there. Receiver-side resume survives reconnects while the receiver tab stays open.

**Backpressure**: sender only waits when `channel.bufferedAmount > 64MB`, using `bufferedamountlow` event + 10ms poll fallback for background tabs.

## Receiver (useIncomingTransfers.js)

`handleDataMessage(data, channel)` receives the channel as second arg for resume handshake. On `file-meta`, it records a pending incoming request and waits for `acceptIncoming()`. Disk-backed transfers use `showSaveFilePicker()` and `FileSystemWritableFileStream.write()` per chunk; fallback transfers allocate one `ArrayBuffer` after acceptance. React state updates are throttled to every 150ms.

## Signaling Socket (useSignalingSocket.js)

Custom WebSocket client (not socket.io). Message format: `{ event, payload, requestId? }`. Has a `generateId()` fallback for `crypto.randomUUID()` which fails in non-secure contexts (HTTP on LAN). `defaultSignalingUrl()` returns `window.location.origin` — WebSocket goes through Vite proxy to server.

## Gotchas

- `onDataMessage` in `usePeerConnection.js` passes `(event.data, nextChannel)` — both args required
- `crypto.randomUUID()` doesn't work over plain HTTP on non-localhost — use `generateId()` instead
- Server CORS allows all origins when no `CLIENT_ORIGIN` env is set
- No tests, no linting configured
- `CHUNK_SIZE` must stay ≤256KB — larger values hit WebRTC SCTP max message size limit

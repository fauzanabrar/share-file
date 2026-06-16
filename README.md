# Share File

Browser-based local file transfer using WebRTC DataChannels. The signaling server lists users on the same LAN and coordinates peer setup only; file bytes move directly between browsers.

## What It Does

- Shows nearby LAN users with random usernames/device names.
- Connects by clicking a user; no room code is required.
- Transfers files over a direct WebRTC DataChannel.
- Streams received files directly to disk in supported browsers, avoiding full-file memory use for large files.
- Supports sender-side resume and reconnect resume while the receiver tab stays open.

## Commands

```bash
npm install
npm run dev        # starts client (:5180) and server (:3000) concurrently
npm run dev:client # client only
npm run dev:server # server only
npm run build      # builds client for production
npm start          # runs signaling server (production)
```

## Workspace Layout

- `client/` - React + Vite browser app
- `server/` - Express + `ws` signaling server
- `client/src/modules/*/README.md` - frontend module summaries
- `server/src/modules/*/README.md` - backend module summaries

## How It Works

1. Each browser gets a random username/device name and announces itself to the signaling server.
2. Users on the same LAN appear in the Users panel.
3. Clicking a user sends a connect request; the receiver accepts after its signaling listener is ready.
4. WebRTC negotiates a direct connection and opens a DataChannel.
5. The Transfer panel enables file sending only after the DataChannel is open.
6. File bytes transfer peer-to-peer in 256KB chunks with backpressure and resume support.

## Environment

- `VITE_SIGNALING_URL` - override signaling URL for production clients.
- `CLIENT_ORIGIN` - comma-separated allowed origins; all origins are allowed when unset.
- Local client uses port `5180`; server uses port `3000`.
- Vite dev server proxies `/ws` and `/api` to the server.

## Browser Notes

Disk-backed receiving uses the File System Access API when available. Browsers without that API fall back to an in-memory receive buffer, so very large incoming files can still require large memory on those browsers.

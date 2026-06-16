# Share File

Browser-based local file transfer using WebRTC DataChannels. Signaling server coordinates room pairing only; file bytes move peer-to-peer.

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
- `server/` - Express + ws signaling server
- `client/src/modules/*/README.md` - AI-facing summaries for frontend modules
- `server/src/modules/*/README.md` - AI-facing summaries for backend modules

## How It Works

1. User creates a room → gets a 6-char code
2. Second user joins with the code → signaling server pairs them
3. WebRTC DataChannel established → file bytes transfer peer-to-peer
4. Transfers support background tabs (reduced speed) and resume after page reload

## Environment

- `VITE_SIGNALING_URL` - override signaling URL for production clients
- `CLIENT_ORIGIN` - comma-separated allowed origins (allows all if unset)
- Local client uses port `5180`, server uses port `3000`
- Vite dev server proxies `/ws` and `/api` to server

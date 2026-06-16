# Client

React + Vite app for showing LAN users, connecting two browsers, and moving files through a WebRTC DataChannel.

The first screen is the actual transfer app: a Users panel and a Transfer panel. Room codes, activity logs, and device/peer metric rails are intentionally not part of the current UI.

Feature modules live in `src/modules/`. Each module owns its UI, hooks, protocol helpers, and a local `README.md` so future AI agents can load only the relevant module summary before editing.

## Runtime Flow

1. `useSignalingSocket()` connects to the server and buffers early events until listeners exist.
2. `App.jsx` announces the local random username/device name.
3. `PairingCard.jsx` displays visible LAN users and handles click-to-connect.
4. `usePeerConnection()` registers signaling listeners, exposes `signalingReady`, negotiates WebRTC, and exposes the DataChannel state.
5. `FileTransferPanel.jsx` enables sending only when the DataChannel is open.

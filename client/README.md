# Client

React + Vite app for automatic multi-peer LAN auto-pairing, decentralized file catalog sharing, and peer-to-peer file transfers using WebRTC DataChannels.

The interface is streamlined into a single-column Transfer panel that displays:
- Active LAN device status badges and their live WebRTC states.
- **Clickable drop zone** that opens the file picker, supports drag-and-drop (full-screen overlay), and clipboard paste (Ctrl+V / Cmd+V).
- **Share Text** textarea to type or paste text and send it to all connected peers (Ctrl+Enter / Cmd+Enter to send).
- **Auto-send** — files are sent immediately when added if peers are connected. No Send button needed.
- Upload progress card with speed, byte counts, and inline cancel (X) button.
- Interrupted transfers with options to Resume or Dismiss.
- **Your Shared Files** section showing files the sender has staged in their catalog.
- Centered, backdrop-blurred modal prompts for accepting incoming pushed transfers.
- **Received Texts** section showing text messages from peers with one-click Copy and Dismiss buttons.
- **Files Available on LAN** catalog list with one-click direct download actions.
- **Completed Downloads** list with status indicators.

The app is installable as a **Progressive Web App** (PWA) in Chrome and Edge, configured via `vite-plugin-pwa` in `vite.config.js`. It includes a web manifest with standard and maskable icons, a Workbox-generated service worker with auto-update, and Apple PWA meta tags in `index.html`.

Feature modules live in `src/modules/`. Each module owns its UI, hooks, and local summaries.

## Runtime Flow

1. `useSignalingSocket()` connects to the server and buffers early socket events.
2. `App.jsx` announces the local random username/device name.
3. `usePeerConnections()` (plural) establishes automatic WebRTC handshakes with all discovered LAN users. It resolves offer collisions (glare) deterministically using lexicographical client ID sorting.
4. Once connected, peers synchronize their shared file catalogs via data channel control messages.
5. `FileTransferPanel.jsx` allows users to select files to stage/share, and request files from the LAN catalog.
6. The transfer module handles sequential chunk transmission, backpressure flow controls, disk-streaming file system sinks, and automatic cleanup of write handles on peer disconnection.

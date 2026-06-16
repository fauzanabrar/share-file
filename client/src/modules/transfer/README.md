# Transfer Module

Owns file selection, incoming file acceptance, chunked sending, receiving, progress, cancel, resume, and completed download records.

## Features & UX Flows

- **Multi-File Queue**: Supports choosing and staging multiple files to send. Files are transferred sequentially over the WebRTC DataChannel.
- **Directory Download Mode (Save All / Accept All)**: When multiple files are received, the receiver can choose to "Save All". This opens a directory picker (`window.showDirectoryPicker()`) to accept and download the entire queue into a single directory without repeating prompts.
- **Completed Downloads Actions**: Renders "Download All" and "Clear All" buttons to quickly download all buffered files or clear the list and revoke their blob URLs.

## Entry Points

- `FileTransferPanel.jsx` renders the Transfer panel controls, selected files list, progress, and completed downloads.
- `transferProtocol.js` defines DataChannel control messages, deterministic file IDs, and chunk sending with backpressure.
- `useIncomingTransfers.js` manages incoming files, directory-writing sinks, and in-memory fallbacks.

## Protocol

Control messages are JSON strings with a `type` field. File bytes are sent as ordered binary `ArrayBuffer` chunks over the same reliable `RTCDataChannel`.

Important message types:
- `file-meta` announces file metadata, deterministic file ID, as well as `queueIndex` and `queueSize` for sequential transfer management.
- `file-resume` tells the sender which byte offset the receiver already has.
- `file-done` closes a successful transfer.
- `file-cancel` stops an in-progress transfer.

## Memory Behavior

When `showSaveFilePicker()` or `showDirectoryPicker()` is available, the receiver writes each chunk directly to the selected file stream and does not allocate the full file in memory. Browsers without File System Access support fall back to one in-memory buffer after the user accepts the incoming file.

## AI Context

Keep this module independent from signaling transport. Folder queues, checksums, and stronger persistent receiver-side resume should be added here without changing peer discovery or signaling modules.

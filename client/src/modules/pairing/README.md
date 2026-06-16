# Pairing Module

Owns the room UI and user actions for creating, joining, copying, and leaving rooms.

## Entry Points

- `PairingCard.jsx` renders the room controls.

## Data Contract

The parent app passes `room`, `roomUrl`, `remotePeerId`, and callbacks that emit Socket.IO events. This module does not talk to Socket.IO directly.

## AI Context

Keep this module focused on user intent and room display. QR codes, invitation links, and join validation should be added here without leaking file-transfer logic into the component.


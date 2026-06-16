# Pairing Module

Owns the LAN user list and click-to-connect actions.

## Entry Points

- `PairingCard.jsx` renders the local username/device name, available LAN users, connected peer row, and connect/disconnect controls.

## Data Contract

The parent app passes the local peer, visible peers, active peer, DataChannel state, and callbacks that emit WebSocket events. This module does not talk to the signaling socket directly.

## UI Behavior

The connected peer row shows `Connecting` until the DataChannel state is `open`, then shows `Connected`. Transfer controls are owned by the transfer module and should only enable after the channel is open.

## AI Context

Keep this module focused on user intent and peer display. Discovery, pairing, and connection state belong here; file-transfer logic should stay in the transfer module.

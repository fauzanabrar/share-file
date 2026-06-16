import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_PEERS = 2;

export class RoomStore {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  create(socketId) {
    this.leave(socketId);

    const roomCode = this.createUniqueCode();
    const room = {
      roomCode,
      peers: new Set([socketId]),
      createdAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socketId, roomCode);
    return room;
  }

  join(roomCode, socketId) {
    const normalized = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalized);

    if (!room) {
      return { ok: false, error: "Room not found." };
    }

    if (room.peers.size >= MAX_PEERS && !room.peers.has(socketId)) {
      return { ok: false, error: "Room is full." };
    }

    this.leave(socketId);
    const existingPeers = this.getPeers(normalized);
    room.peers.add(socketId);
    this.socketToRoom.set(socketId, normalized);

    return { ok: true, room, existingPeers };
  }

  leave(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (room) {
      room.peers.delete(socketId);
      if (room.peers.size === 0) {
        this.rooms.delete(roomCode);
      }
    }

    this.socketToRoom.delete(socketId);
    return roomCode;
  }

  getPeers(roomCode, exceptSocketId = "") {
    const room = this.rooms.get(normalizeRoomCode(roomCode));
    if (!room) {
      return [];
    }

    return [...room.peers].filter((peerId) => peerId !== exceptSocketId);
  }

  getRoomCodeForSocket(socketId) {
    return this.socketToRoom.get(socketId) || "";
  }

  createUniqueCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = createRoomCode();
      if (!this.rooms.has(code)) {
        return code;
      }
    }

    throw new Error("Could not allocate room code.");
  }
}

function createRoomCode() {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(roomCode) {
  return String(roomCode || "")
    .trim()
    .toUpperCase();
}


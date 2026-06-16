import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, Link2, PlugZap, AlertCircle } from "lucide-react";
import { PairingCard } from "./modules/pairing/PairingCard.jsx";
import { usePeerConnection } from "./modules/peer/usePeerConnection.js";
import { useSignalingSocket } from "./modules/signaling/useSignalingSocket.js";
import { ConnectionStatus } from "./modules/status/ConnectionStatus.jsx";
import { FileTransferPanel } from "./modules/transfer/FileTransferPanel.jsx";
import { useIncomingTransfers } from "./modules/transfer/useIncomingTransfers.js";

let eventCounter = 0;

function generateId() {
  return `${Date.now()}-${++eventCounter}-${Math.floor(Math.random() * 100000)}`;
}

export function App() {
  const { socket, connected: signalingConnected, connectionError } = useSignalingSocket();
  const [room, setRoom] = useState(null);
  const [remotePeerId, setRemotePeerId] = useState("");
  const [isInitiator, setIsInitiator] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [events, setEvents] = useState([]);
  const [readySent, setReadySent] = useState(false);
  const {
    incoming,
    downloads,
    handleDataMessage,
    acceptIncoming,
    rejectIncoming,
    clearDownload,
  } = useIncomingTransfers();

  const addEvent = useCallback((message) => {
    setEvents((current) => [
      { id: generateId(), message, at: new Date().toLocaleTimeString() },
      ...current.slice(0, 5),
    ]);
  }, []);

  const {
    channel,
    channelState,
    connectionState,
    iceConnectionState,
    resetPeer,
  } = usePeerConnection({
    socket,
    roomCode: room?.roomCode,
    remotePeerId,
    isInitiator,
    onDataMessage: handleDataMessage,
    onEvent: addEvent,
  });

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handlePeerJoined = ({ peerId }) => {
      setRemotePeerId(peerId);
      setIsInitiator(false);
      addEvent("Peer joined room.");
    };

    const handlePeerReady = ({ peerId }) => {
      setRemotePeerId(peerId);
      setIsInitiator(true);
      addEvent("Peer is ready.");
    };

    const handlePeerLeft = () => {
      setRemotePeerId("");
      setIsInitiator(false);
      resetPeer();
      addEvent("Peer left room.");
    };

    socket.on("room:peer-joined", handlePeerJoined);
    socket.on("room:peer-ready", handlePeerReady);
    socket.on("room:peer-left", handlePeerLeft);

    return () => {
      socket.off("room:peer-joined", handlePeerJoined);
      socket.off("room:peer-ready", handlePeerReady);
      socket.off("room:peer-left", handlePeerLeft);
    };
  }, [addEvent, resetPeer, socket]);

  useEffect(() => {
    if (!socket || !room || !remotePeerId || room.role !== "joiner" || readySent) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      socket.emit("room:ready", { roomCode: room.roomCode });
      setReadySent(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [readySent, remotePeerId, room, socket]);

  const createRoom = useCallback(() => {
    if (!socket) {
      return;
    }

    setRoomError("");
    socket.emit("room:create", {}, (response) => {
      if (!response?.ok) {
        setRoomError(response?.error || "Could not create room.");
        return;
      }

      setRoom({ roomCode: response.roomCode, role: "host", peerId: response.peerId });
      setRemotePeerId("");
      setIsInitiator(false);
      setReadySent(false);
      addEvent("Room created.");
    });
  }, [addEvent, socket]);

  const joinRoom = useCallback(
    (roomCode) => {
      if (!socket) {
        return;
      }

      setRoomError("");
      socket.emit("room:join", { roomCode }, (response) => {
        if (!response?.ok) {
          setRoomError(response?.error || "Could not join room.");
          return;
        }

        setRoom({ roomCode: response.roomCode, role: "joiner", peerId: response.peerId });
        setRemotePeerId(response.peers?.[0] || "");
        setIsInitiator(false);
        setReadySent(false);
        addEvent("Joined room.");
      });
    },
    [addEvent, socket],
  );

  const leaveRoom = useCallback(() => {
    if (socket && room?.roomCode) {
      socket.emit("room:leave", { roomCode: room.roomCode });
    }

    resetPeer();
    setRoom(null);
    setRemotePeerId("");
    setIsInitiator(false);
    setReadySent(false);
    addEvent("Room closed.");
  }, [addEvent, resetPeer, room, socket]);

  const roomUrl = useMemo(() => {
    if (!room?.roomCode) {
      return "";
    }

    const url = new URL(window.location.href);
    url.searchParams.set("room", room.roomCode);
    return url.toString();
  }, [room]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("room");
    if (code && signalingConnected && !room) {
      joinRoom(code);
    }
  }, [joinRoom, room, signalingConnected]);

  return (
    <main className="shell">
      <section className="workspace" aria-label="Share File workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Share File</p>
            <h1>Local browser transfer</h1>
          </div>
          <ConnectionStatus
            signalingConnected={signalingConnected}
            connectionState={connectionState}
            iceConnectionState={iceConnectionState}
            channelState={channelState}
          />
        </header>

        {connectionError && (
          <div className="connection-error-banner" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>Signaling connection error: {connectionError}</span>
            <small>Check that the server is running and accessible from this device.</small>
          </div>
        )}

        <div className="grid">
          <PairingCard
            room={room}
            roomUrl={roomUrl}
            remotePeerId={remotePeerId}
            error={roomError}
            disabled={!signalingConnected}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onLeaveRoom={leaveRoom}
          />

          <FileTransferPanel
            channel={channel}
            channelState={channelState}
            incoming={incoming}
            downloads={downloads}
            onAcceptIncoming={acceptIncoming}
            onRejectIncoming={rejectIncoming}
            onClearDownload={clearDownload}
          />
        </div>

        <section className="activity" aria-label="Connection activity">
          <div className="activity-header">
            <h2>Activity</h2>
            <span>{events.length} recent</span>
          </div>
          {events.length === 0 ? (
            <div className="empty-state">
              <PlugZap size={18} aria-hidden="true" />
              <span>No events yet.</span>
            </div>
          ) : (
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <span>{event.message}</span>
                  <time>{event.at}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <aside className="rail" aria-label="Runtime details">
        <div className="metric">
          <Link2 size={18} aria-hidden="true" />
          <span>Room</span>
          <strong>{room?.roomCode || "None"}</strong>
        </div>
        <div className="metric">
          <FileUp size={18} aria-hidden="true" />
          <span>Channel</span>
          <strong>{channelState}</strong>
        </div>
      </aside>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { PairingCard } from "./modules/pairing/PairingCard.jsx";
import { usePeerConnection } from "./modules/peer/usePeerConnection.js";
import { useSignalingSocket } from "./modules/signaling/useSignalingSocket.js";
import { ConnectionStatus } from "./modules/status/ConnectionStatus.jsx";
import { FileTransferPanel } from "./modules/transfer/FileTransferPanel.jsx";
import { useIncomingTransfers } from "./modules/transfer/useIncomingTransfers.js";

export function App() {
  const { socket, connected: signalingConnected, connectionError } = useSignalingSocket();
  const [deviceName] = useState(() => getOrCreateDeviceName());
  const [selfPeer, setSelfPeer] = useState(null);
  const [availablePeers, setAvailablePeers] = useState([]);
  const [remotePeer, setRemotePeer] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [peerError, setPeerError] = useState("");
  const [connectingPeerId, setConnectingPeerId] = useState("");
  const [pendingAcceptPeer, setPendingAcceptPeer] = useState(null);
  const {
    incoming,
    downloads,
    handleDataMessage,
    acceptIncoming,
    rejectIncoming,
    clearDownload,
    clearAllDownloads,
  } = useIncomingTransfers();
  const remotePeerId = remotePeer?.id || "";

  const handlePeerEvent = useCallback((message) => {
    if (/failed|error/i.test(message)) {
      if (/failed/i.test(message)) {
        setPeerError(
          "Connection failed. If you are using a mobile hotspot, direct peer-to-peer connections are often blocked by the mobile OS. Please connect both devices to the same Wi-Fi router."
        );
      } else {
        setPeerError(message);
      }
    }
  }, []);

  const {
    channel,
    channelState,
    connectionState,
    iceConnectionState,
    signalingReady,
    resetPeer,
  } = usePeerConnection({
    socket,
    remotePeerId,
    isInitiator,
    onDataMessage: handleDataMessage,
    onEvent: handlePeerEvent,
  });

  useEffect(() => {
    if (!socket || !signalingConnected) {
      return undefined;
    }

    socket.emit("peer:announce", { displayName: deviceName }, (response) => {
      if (!response?.ok) {
        setPeerError(response?.error || "Could not join LAN user list.");
        return;
      }

      setSelfPeer(response.peer);
    });
  }, [deviceName, signalingConnected, socket]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handlePeerList = ({ self, peers = [] }) => {
      setSelfPeer(self || null);
      setAvailablePeers(peers);
    };

    const handleConnectRequest = ({ peer }) => {
      if (!peer?.id) return;
      setPeerError("");
      setConnectingPeerId("");
      setRemotePeer(peer);
      setIsInitiator(false);
      setPendingAcceptPeer(peer);
    };

    const handleConnectAccepted = ({ peer }) => {
      if (!peer?.id) return;
      setPeerError("");
      setConnectingPeerId("");
      setPendingAcceptPeer(null);
      setRemotePeer(peer);
      setIsInitiator(true);
    };

    const handlePeerDisconnect = ({ peerId } = {}) => {
      if (peerId && remotePeerId && peerId !== remotePeerId) {
        return;
      }

      resetPeer();
      setRemotePeer(null);
      setIsInitiator(false);
      setPendingAcceptPeer(null);
      setConnectingPeerId("");
    };

    socket.on("peer:list", handlePeerList);
    socket.on("peer:connect-request", handleConnectRequest);
    socket.on("peer:connect-accepted", handleConnectAccepted);
    socket.on("peer:disconnect", handlePeerDisconnect);

    return () => {
      socket.off("peer:list", handlePeerList);
      socket.off("peer:connect-request", handleConnectRequest);
      socket.off("peer:connect-accepted", handleConnectAccepted);
      socket.off("peer:disconnect", handlePeerDisconnect);
    };
  }, [remotePeerId, resetPeer, socket]);

  useEffect(() => {
    if (
      !socket ||
      !pendingAcceptPeer ||
      remotePeerId !== pendingAcceptPeer.id ||
      isInitiator ||
      !signalingReady
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      socket.emit("peer:accept", { targetId: pendingAcceptPeer.id }, (response) => {
        if (!response?.ok) {
          setPeerError(response?.error || "Could not accept connection.");
          resetPeer();
          setRemotePeer(null);
          setPendingAcceptPeer(null);
          return;
        }

        setPendingAcceptPeer(null);
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isInitiator, pendingAcceptPeer, remotePeerId, resetPeer, signalingReady, socket]);

  const connectPeer = useCallback((peer) => {
    if (!socket || !peer?.id) {
      return;
    }

    if (remotePeerId && remotePeerId !== peer.id) {
      resetPeer();
      setRemotePeer(null);
      setIsInitiator(false);
    }

    setPeerError("");
    setConnectingPeerId(peer.id);
    socket.emit("peer:connect", { targetId: peer.id }, (response) => {
      if (!response?.ok) {
        setConnectingPeerId("");
        setPeerError(response?.error || "Could not connect to user.");
        return;
      }
    });
  }, [remotePeerId, resetPeer, socket]);

  const disconnectPeer = useCallback(() => {
    socket?.emit("peer:disconnect");
    resetPeer();
    setRemotePeer(null);
    setIsInitiator(false);
    setPendingAcceptPeer(null);
    setConnectingPeerId("");
  }, [resetPeer, socket]);

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
            selfPeer={selfPeer}
            deviceName={deviceName}
            peers={availablePeers}
            connectedPeer={remotePeer}
            channelState={channelState}
            connectingPeerId={connectingPeerId}
            error={peerError}
            disabled={!signalingConnected}
            onConnectPeer={connectPeer}
            onDisconnectPeer={disconnectPeer}
          />

          <FileTransferPanel
            channel={channel}
            channelState={channelState}
            incoming={incoming}
            downloads={downloads}
            onAcceptIncoming={acceptIncoming}
            onRejectIncoming={rejectIncoming}
            onClearDownload={clearDownload}
            onClearAllDownloads={clearAllDownloads}
          />
        </div>
      </section>
    </main>
  );
}

const DEVICE_NAME_KEY = "sharefile:device-name";

function getOrCreateDeviceName() {
  try {
    const existing = localStorage.getItem(DEVICE_NAME_KEY);
    if (existing) {
      return existing;
    }

    const next = createDeviceName();
    localStorage.setItem(DEVICE_NAME_KEY, next);
    return next;
  } catch {
    return createDeviceName();
  }
}

function createDeviceName() {
  const number = Math.floor(1000 + Math.random() * 9000);
  return `Device ${number}`;
}

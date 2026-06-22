import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Info, X } from "lucide-react";
import { usePeerConnections } from "./modules/peer/usePeerConnections.js";
import { useSignalingSocket } from "./modules/signaling/useSignalingSocket.js";
import { ConnectionStatus } from "./modules/status/ConnectionStatus.jsx";
import { FileTransferPanel } from "./modules/transfer/FileTransferPanel.jsx";
import { useIncomingTransfers } from "./modules/transfer/useIncomingTransfers.js";

export function App() {
  const { socket, connected: signalingConnected, connectionError } = useSignalingSocket();
  const [deviceName] = useState(() => getOrCreateDeviceName());
  const [selfPeer, setSelfPeer] = useState(null);
  const [availablePeers, setAvailablePeers] = useState([]);
  const [peerError, setPeerError] = useState("");
  const [sharedFiles, setSharedFiles] = useState(new Map());
  const [receivedTexts, setReceivedTexts] = useState([]);
  const [showTip, setShowTip] = useState(() => localStorage.getItem("sharefile:hide-tip") !== "true");

  const dismissTip = useCallback(() => {
    localStorage.setItem("sharefile:hide-tip", "true");
    setShowTip(false);
  }, []);

  const shareFile = useCallback((fileOrBlob, metadata = {}) => {
    const name = fileOrBlob.name || metadata.name || "file";
    const size = fileOrBlob.size;
    const mimeType = fileOrBlob.type || metadata.mimeType || "application/octet-stream";
    const lastModified = fileOrBlob.lastModified || metadata.lastModified || 0;

    const id = `${name}-${size}-${lastModified}`;
    setSharedFiles((prev) => {
      const next = new Map(prev);
      next.set(id, {
        id,
        name,
        size,
        mimeType,
        fileOrBlob,
      });
      return next;
    });
  }, []);

  const {
    incoming,
    downloads,
    handleDataMessage,
    preCreateSink,
    cancelPreCreatedSink,
    cancelTransfersForPeer,
    acceptIncoming,
    rejectIncoming,
    clearDownload,
    clearAllDownloads,
  } = useIncomingTransfers(shareFile);

  const handlePeerEvent = useCallback((message) => {
    // Relay fallback messages are informational, don't show as errors
    if (/switching to server relay|accepting relay|Relay channel opened/i.test(message)) {
      return;
    }
    if (/failed|error/i.test(message)) {
      setPeerError(message);
    }
    // Clear error on successful direct P2P connection
    if (/Data channel opened/i.test(message)) {
      setPeerError("");
    }
  }, []);

  const handlePeerDisconnect = useCallback((peerId) => {
    cancelTransfersForPeer(peerId);
  }, [cancelTransfersForPeer]);

  const handleTextReceived = useCallback((textMessage) => {
    setReceivedTexts((prev) => [textMessage, ...prev]);
  }, []);

  const { channelStates, getOpenChannels, getIsRelay, networkFiles, requestFile } = usePeerConnections({
    socket,
    selfPeer,
    availablePeers,
    sharedFiles,
    onDataMessage: handleDataMessage,
    onEvent: handlePeerEvent,
    onPeerDisconnect: handlePeerDisconnect,
    onTextReceived: handleTextReceived,
  });

  const shareText = useCallback((text) => {
    const channels = getOpenChannels();
    if (channels.length === 0) return false;
    const id = `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg = JSON.stringify({
      type: "text-share",
      id,
      text,
      timestamp: Date.now(),
    });
    channels.forEach(({ record }) => {
      try {
        record.channel.send(msg);
      } catch {}
    });
    return true;
  }, [getOpenChannels]);

  const clearReceivedText = useCallback((id) => {
    setReceivedTexts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllReceivedTexts = useCallback(() => {
    setReceivedTexts([]);
  }, []);

  const handleRequestFile = useCallback(
    async (fileId, ownerId, meta) => {
      setPeerError("");
      const ok = await preCreateSink(fileId, meta, ownerId);
      if (ok) {
        try {
          requestFile(fileId, ownerId);
        } catch (err) {
          setPeerError(err.message);
          cancelPreCreatedSink(fileId);
        }
      }
    },
    [preCreateSink, requestFile, cancelPreCreatedSink]
  );

  useEffect(() => {
    if (!socket || !signalingConnected) {
      return undefined;
    }

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      setPeerError("Could not reach signaling server. Retrying...");
    }, 5000);

    socket.emit("peer:announce", { displayName: deviceName }, (response) => {
      clearTimeout(timeout);
      if (timedOut) return;
      if (!response?.ok) {
        setPeerError(response?.error || "Could not join LAN user list.");
        return;
      }
      setPeerError("");
      setSelfPeer(response.peer);
    });

    return () => {
      clearTimeout(timeout);
    };
  }, [deviceName, signalingConnected, socket]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handlePeerList = ({ self, peers = [] }) => {
      setSelfPeer(self || null);
      setAvailablePeers(peers);
    };

    socket.on("peer:list", handlePeerList);

    return () => {
      socket.off("peer:list", handlePeerList);
    };
  }, [socket]);

  const activePeers = availablePeers.filter((p) => channelStates[p.id] === "open");
  const connectedCount = activePeers.length;
  const peerCount = availablePeers.length;

  return (
    <main className="shell">
      <section className="workspace" aria-label="Share File workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Share File</p>
            <h1>Local browser transfer</h1>
            <p className="active-devices-subtitle">
              {selfPeer ? `Logged in as ${selfPeer.displayName}` : `Registering as ${deviceName}...`}
              {connectedCount > 0
                ? ` • Connected to: ${activePeers.map((p) => p.displayName).join(", ")}`
                : peerCount > 0
                ? " • Connecting to devices..."
                : " • Waiting for other devices on the same Wi-Fi..."}
            </p>
          </div>
          <ConnectionStatus
            signalingConnected={signalingConnected}
            peerCount={peerCount}
            connectedCount={connectedCount}
          />
        </header>

        {showTip && (
          <div className="network-suggestion-banner">
            <div className="network-suggestion-content">
              <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span><strong>Tip:</strong> For the fastest and most reliable transfers, ensure both devices are connected to the same Wi-Fi or LAN network.</span>
            </div>
            <button className="icon-button dismiss-btn" onClick={dismissTip} aria-label="Dismiss tip" title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {connectionError && (
          <div className="connection-error-banner" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>Signaling connection error: {connectionError}</span>
            <small>Check that the server is running and accessible from this device.</small>
          </div>
        )}

        {peerError && (
          <div className="connection-error-banner" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>Network warning: {peerError}</span>
          </div>
        )}

        <div className="single-column-layout">
          <FileTransferPanel
            getOpenChannels={getOpenChannels}
            getIsRelay={getIsRelay}
            channelStates={channelStates}
            incoming={incoming}
            downloads={downloads}
            networkFiles={networkFiles}
            sharedFiles={sharedFiles}
            receivedTexts={receivedTexts}
            onRequestFile={handleRequestFile}
            onShareFile={shareFile}
            onShareText={shareText}
            onAcceptIncoming={acceptIncoming}
            onRejectIncoming={rejectIncoming}
            onClearDownload={clearDownload}
            onClearAllDownloads={clearAllDownloads}
            onClearReceivedText={clearReceivedText}
            onClearAllReceivedTexts={clearAllReceivedTexts}
            availablePeers={availablePeers}
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

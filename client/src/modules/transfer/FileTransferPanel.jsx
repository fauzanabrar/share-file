import { useEffect, useRef, useState } from "react";
import { Download, FileCheck, Send, Square, RotateCcw } from "lucide-react";
import {
  sendFile,
  createFileId,
  getPendingTransferStates,
  clearTransferState,
} from "./transferProtocol.js";

export function FileTransferPanel({
  channel,
  channelState,
  incoming,
  downloads,
  onAcceptIncoming,
  onRejectIncoming,
  onClearDownload,
}) {
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(null);
  const [error, setError] = useState("");
  const [acceptingIncoming, setAcceptingIncoming] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [resumeId, setResumeId] = useState(null);
  const channelReady = channelState === "open";

  // Load pending (interrupted) transfers from localStorage on mount.
  useEffect(() => {
    setPendingTransfers(getPendingTransferStates());
  }, []);

  // When the user picks a file and we were waiting for resume, start sending.
  useEffect(() => {
    if (selectedFile && resumeId) {
      startSendWithFile(selectedFile, resumeId);
      setResumeId(null);
    }
  }, [selectedFile, resumeId]);

  const startSendWithFile = async (file, pendingId) => {
    if (!file) {
      return;
    }

    if (pendingId && createFileId(file) !== pendingId) {
      setError("Select the same file to resume this transfer.");
      setSelectedFile(null);
      setPendingTransfers(getPendingTransferStates());
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setSending({
      name: file.name,
      sentBytes: 0,
      totalBytes: file.size,
      speedBytesPerSecond: 0,
    });

    try {
      await sendFile({
        channel,
        file,
        signal: controller.signal,
        onProgress: (progress) => {
          setSending({
            name: file.name,
            sentBytes: progress.sentBytes,
            totalBytes: progress.totalBytes,
            speedBytesPerSecond: progress.speedBytesPerSecond,
          });
        },
      });
      setSelectedFile(null);
      setPendingTransfers(getPendingTransferStates());
    } catch (sendError) {
      if (sendError.message !== "Transfer cancelled.") {
        setError(sendError.message);
      }
      setPendingTransfers(getPendingTransferStates());
    } finally {
      abortRef.current = null;
      window.setTimeout(() => setSending(null), 900);
    }
  };

  const startSend = () => {
    startSendWithFile(selectedFile);
  };

  const cancelSend = () => {
    abortRef.current?.abort();
  };

  const handleResumeClick = (pt) => {
    setResumeId(pt.id);
    // Trigger the hidden file input.
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      // User cancelled the file picker — clear resume state.
      setResumeId(null);
      return;
    }
    setSelectedFile(file);
    // Reset so the same file can be picked again.
    event.target.value = "";
  };

  const dismissPending = (id) => {
    clearTransferState(id);
    setPendingTransfers(getPendingTransferStates());
  };

  const acceptIncoming = async () => {
    setAcceptingIncoming(true);
    setError("");

    try {
      await onAcceptIncoming?.();
    } catch (acceptError) {
      if (acceptError.name !== "AbortError") {
        setError(acceptError.message || "Could not accept incoming transfer.");
      }
    } finally {
      setAcceptingIncoming(false);
    }
  };

  const rejectIncoming = () => {
    onRejectIncoming?.();
  };

  return (
    <section className="panel" aria-label="File transfer">
      <div className="panel-header">
        <div className="panel-title">
          <Send size={19} aria-hidden="true" />
          <h2>Transfer</h2>
        </div>
        <span className={`status-pill ${channelReady ? "ready" : "warning"}`}>
          <span className="status-dot" />
          {channelState}
        </span>
      </div>

      {/* Pending (interrupted) transfers */}
      {pendingTransfers.length > 0 && !sending ? (
        <div className="pending-stack">
          {pendingTransfers.map((pt) => (
            <div className="pending-card" key={pt.id}>
              <div className="download-row">
                <strong>{pt.name}</strong>
                <span>{formatBytes(pt.lastSentOffset)} / {formatBytes(pt.size)}</span>
              </div>
              <p className="pending-hint">Select the same file to resume from where it stopped.</p>
              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  disabled={!channelReady}
                  onClick={() => handleResumeClick(pt)}
                >
                  <RotateCcw size={17} aria-hidden="true" />
                  Resume
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => dismissPending(pt.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="file-picker">
        <input
          ref={fileInputRef}
          type="file"
          disabled={!channelReady || Boolean(sending)}
          onChange={handleFileChange}
        />
        <div className="button-row">
          <button
            className="button"
            type="button"
            disabled={!channelReady || !selectedFile || Boolean(sending)}
            onClick={startSend}
          >
            <Send size={17} aria-hidden="true" />
            Send
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!sending}
            onClick={cancelSend}
          >
            <Square size={16} aria-hidden="true" />
            Cancel
          </button>
        </div>
      </div>

      {sending ? (
        <TransferProgress
          label={sending.name}
          bytes={sending.sentBytes}
          total={sending.totalBytes}
          speed={sending.speedBytesPerSecond}
        />
      ) : null}

      {incoming?.status === "waiting" ? (
        <IncomingRequest
          incoming={incoming}
          accepting={acceptingIncoming}
          onAccept={acceptIncoming}
          onReject={rejectIncoming}
        />
      ) : null}

      {incoming && incoming.status !== "waiting" ? (
        <TransferProgress
          label={incoming.meta.name}
          bytes={incoming.receivedBytes}
          total={incoming.meta.size}
          speed={0}
          status={incoming.status}
          incoming
        />
      ) : null}

      {incoming?.error ? <p className="error">{incoming.error}</p> : null}

      {downloads.length > 0 ? (
        <div className="download-stack">
          {downloads.map((download) => (
            <div className="download-card" key={download.id}>
              <div className="download-row">
                <strong>{download.name}</strong>
                <span>{formatBytes(download.size)}</span>
              </div>
              <div className="button-row">
                {download.url ? (
                  <a className="button" href={download.url} download={download.name}>
                    <Download size={17} aria-hidden="true" />
                    Download
                  </a>
                ) : (
                  <span className="download-saved">
                    <FileCheck size={17} aria-hidden="true" />
                    Saved
                  </span>
                )}
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => onClearDownload(download.id)}
                >
                  <FileCheck size={17} aria-hidden="true" />
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function IncomingRequest({ incoming, accepting, onAccept, onReject }) {
  return (
    <div className="transfer-card">
      <div className="transfer-row">
        <strong>{incoming.meta.name}</strong>
        <span>{formatBytes(incoming.meta.size)}</span>
      </div>
      <div className="button-row">
        <button
          className="button"
          type="button"
          disabled={accepting}
          onClick={onAccept}
        >
          <Download size={17} aria-hidden="true" />
          {incoming.storageMode === "disk" ? "Save" : "Accept"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={accepting}
          onClick={onReject}
        >
          <Square size={16} aria-hidden="true" />
          Reject
        </button>
      </div>
    </div>
  );
}

function TransferProgress({ label, bytes, total, speed, status, incoming = false }) {
  const percent = total ? Math.min(100, Math.round((bytes / total) * 100)) : 0;
  const statusText = incoming
    ? incomingStatusText(status)
    : `${formatBytes(speed)}/s`;

  return (
    <div className="transfer-card">
      <div className="transfer-row">
        <strong>{label}</strong>
        <span>{statusText}</span>
      </div>
      <div className="progress-shell" aria-label={`${percent}% complete`}>
        <div className="progress-bar" style={{ "--progress": `${percent}%` }} />
      </div>
      <div className="transfer-row">
        <span>{formatBytes(bytes)}</span>
        <span>{formatBytes(total)}</span>
      </div>
    </div>
  );
}

function incomingStatusText(status) {
  if (status === "finalizing") {
    return "Saving";
  }
  if (status === "failed") {
    return "Failed";
  }
  return "Receiving";
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

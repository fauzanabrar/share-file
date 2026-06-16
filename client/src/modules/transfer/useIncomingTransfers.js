import { useCallback, useRef, useState } from "react";

export function useIncomingTransfers() {
  const activeRef = useRef(null);
  const pendingRef = useRef(null);
  const partialTransfersRef = useRef(new Map());
  const [incoming, setIncoming] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const lastUpdateRef = useRef(0);

  const failActiveTransfer = useCallback((active, message) => {
    if (!active || active.failed) {
      return;
    }

    active.failed = true;
    active.sink.abort?.();
    partialTransfersRef.current.delete(active.id);

    if (active.channel?.readyState === "open") {
      active.channel.send(JSON.stringify({ type: "file-cancel", id: active.id }));
    }

    if (activeRef.current?.id === active.id) {
      activeRef.current = null;
    }

    setIncoming({
      meta: active.meta,
      receivedBytes: active.receivedBytes,
      status: "failed",
      storageMode: active.storageMode,
      error: message,
    });
  }, []);

  const finishActiveTransfer = useCallback(
    async (id) => {
      const active = activeRef.current;
      if (!active || active.id !== id) {
        return;
      }

      setIncoming(toIncomingState(active, "finalizing"));

      try {
        await active.writeChain;
        if (active.receivedBytes !== active.meta.size) {
          throw new Error("Transfer ended before all bytes were received.");
        }

        const result = await active.sink.close();
        setDownloads((current) => [
          {
            id: active.meta.id,
            name: active.meta.name,
            size: active.meta.size,
            url: result?.url || "",
            savedToDisk: Boolean(result?.savedToDisk),
            createdAt: Date.now(),
          },
          ...current,
        ]);
        setIncoming(null);
        activeRef.current = null;
        partialTransfersRef.current.delete(active.id);
      } catch (error) {
        failActiveTransfer(active, error.message || "Could not save received file.");
      }
    },
    [failActiveTransfer],
  );

  const handleDataMessage = useCallback(
    (data, channel) => {
      if (typeof data === "string") {
        const message = parseControlMessage(data);
        if (!message) {
          return;
        }

        if (message.type === "file-meta") {
          const existing = partialTransfersRef.current.get(message.id);
          pendingRef.current = { meta: message, channel };

          if (existing?.meta.size === message.size) {
            existing.meta = message;
            existing.channel = channel;
            activeRef.current = existing;
            setIncoming(toIncomingState(existing, "receiving"));
            sendResumeOffset(channel, message.id, existing.receivedBytes);
            return;
          }

          setIncoming({
            meta: message,
            receivedBytes: 0,
            status: "waiting",
            storageMode: canStreamToDisk() ? "disk" : "memory",
          });
          return;
        }

        if (message.type === "file-done") {
          finishActiveTransfer(message.id);
          return;
        }

        if (message.type === "file-cancel") {
          const active = activeRef.current;
          if (active?.id === message.id) {
            active.sink.abort?.();
            activeRef.current = null;
          }

          partialTransfersRef.current.delete(message.id);
          if (pendingRef.current?.meta.id === message.id) {
            pendingRef.current = null;
          }
          setIncoming(null);
        }

        return;
      }

      const active = activeRef.current;
      if (!active || active.failed) {
        return;
      }

      const chunk = new Uint8Array(data);
      const position = active.receivedBytes;
      if (position + chunk.byteLength > active.meta.size) {
        failActiveTransfer(active, "Received more data than expected.");
        return;
      }

      active.receivedBytes += chunk.byteLength;
      active.writeChain = active.writeChain.then(() => active.sink.write(chunk, position));
      active.writeChain.catch(() => {
        failActiveTransfer(active, "Could not write received data.");
      });
      partialTransfersRef.current.set(active.id, active);

      const now = performance.now();
      if (now - lastUpdateRef.current >= 150 || active.receivedBytes >= active.meta.size) {
        lastUpdateRef.current = now;
        setIncoming(toIncomingState(active, "receiving"));
      }
    },
    [failActiveTransfer, finishActiveTransfer],
  );

  const acceptIncoming = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending?.meta || !pending.channel || pending.channel.readyState !== "open") {
      throw new Error("No incoming transfer is ready.");
    }

    const existing = partialTransfersRef.current.get(pending.meta.id);
    const active = existing?.meta.size === pending.meta.size
      ? existing
      : await createIncomingTransfer(pending.meta);

    active.meta = pending.meta;
    active.channel = pending.channel;
    active.failed = false;
    activeRef.current = active;
    partialTransfersRef.current.set(active.id, active);
    pendingRef.current = null;
    lastUpdateRef.current = performance.now();
    setIncoming(toIncomingState(active, "receiving"));
    sendResumeOffset(active.channel, active.id, active.receivedBytes);
  }, []);

  const rejectIncoming = useCallback(() => {
    const pending = pendingRef.current;
    const active = activeRef.current;
    const id = pending?.meta.id || active?.id;
    const channel = pending?.channel || active?.channel;

    if (channel?.readyState === "open" && id) {
      channel.send(JSON.stringify({ type: "file-cancel", id }));
    }

    if (active) {
      active.sink.abort?.();
      partialTransfersRef.current.delete(active.id);
    }

    pendingRef.current = null;
    activeRef.current = null;
    setIncoming(null);
  }, []);

  const clearDownload = useCallback((id) => {
    setDownloads((current) => {
      const download = current.find((item) => item.id === id);
      if (download?.url) URL.revokeObjectURL(download.url);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  return {
    incoming,
    downloads,
    handleDataMessage,
    acceptIncoming,
    rejectIncoming,
    clearDownload,
  };
}

async function createIncomingTransfer(meta) {
  const sink = canStreamToDisk()
    ? await createDiskSink(meta)
    : createMemorySink(meta);

  return {
    id: meta.id,
    meta,
    sink,
    storageMode: sink.storageMode,
    receivedBytes: 0,
    writeChain: Promise.resolve(),
    failed: false,
  };
}

async function createDiskSink(meta) {
  const handle = await window.showSaveFilePicker({
    id: "share-file-downloads",
    suggestedName: meta.name,
    startIn: "downloads",
  });
  const writable = await handle.createWritable();

  return {
    storageMode: "disk",
    async write(chunk, position) {
      await writable.write({ type: "write", position, data: chunk });
    },
    async close() {
      await writable.close();
      return { savedToDisk: true };
    },
    async abort() {
      if (typeof writable.abort === "function") {
        await writable.abort();
      }
    },
  };
}

function createMemorySink(meta) {
  let buffer;
  try {
    buffer = new ArrayBuffer(meta.size);
  } catch {
    throw new Error("This browser cannot stream directly to disk and does not have enough memory for this file.");
  }

  const view = new Uint8Array(buffer);
  return {
    storageMode: "memory",
    async write(chunk, position) {
      view.set(chunk, position);
    },
    async close() {
      const blob = new Blob([buffer], { type: meta.mimeType });
      return { url: URL.createObjectURL(blob), savedToDisk: false };
    },
    async abort() {},
  };
}

function canStreamToDisk() {
  return Boolean(window.isSecureContext && window.showSaveFilePicker);
}

function parseControlMessage(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function sendResumeOffset(channel, id, offset) {
  if (channel?.readyState !== "open") {
    return;
  }

  channel.send(JSON.stringify({
    type: "file-resume",
    id,
    offset,
  }));
}

function toIncomingState(active, status) {
  return {
    meta: active.meta,
    receivedBytes: active.receivedBytes,
    status,
    storageMode: active.storageMode,
  };
}

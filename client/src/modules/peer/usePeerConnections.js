import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_CHANNEL_LABEL, peerConnectionConfig } from "./peerConfig.js";

export function usePeerConnections({
  socket,
  selfPeer,
  availablePeers,
  onDataMessage,
  onEvent,
}) {
  const connectionsRef = useRef(new Map());
  const [channelStates, setChannelStates] = useState({});

  const configureChannel = useCallback(
    (peerId, displayName, nextChannel) => {
      nextChannel.binaryType = "arraybuffer";
      nextChannel.bufferedAmountLowThreshold = 4 * 1024 * 1024;

      const record = connectionsRef.current.get(peerId);
      if (record) {
        record.channel = nextChannel;
      }

      setChannelStates((prev) => ({ ...prev, [peerId]: nextChannel.readyState }));

      nextChannel.onopen = () => {
        setChannelStates((prev) => ({ ...prev, [peerId]: nextChannel.readyState }));
        onEvent?.(`Data channel opened with ${displayName}.`);
      };

      nextChannel.onclose = () => {
        setChannelStates((prev) => ({ ...prev, [peerId]: nextChannel.readyState }));
        onEvent?.(`Data channel closed with ${displayName}.`);
      };

      nextChannel.onmessage = (event) => {
        onDataMessage?.(event.data, nextChannel);
      };
    },
    [onDataMessage, onEvent]
  );

  const setupPeerConnection = useCallback(
    (peerId, displayName, isInitiator) => {
      const pc = new RTCPeerConnection(peerConnectionConfig);
      const record = {
        pc,
        channel: null,
        pendingCandidates: [],
        isInitiator,
        displayName,
      };

      connectionsRef.current.set(peerId, record);
      setChannelStates((prev) => ({ ...prev, [peerId]: "connecting" }));

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          onEvent?.(`WebRTC connection failed with ${displayName}.`);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          onEvent?.(`ICE connection failed with ${displayName}.`);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateJson = typeof event.candidate.toJSON === "function"
            ? event.candidate.toJSON()
            : {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                usernameFragment: event.candidate.usernameFragment,
              };

          socket.emit("signal:send", {
            targetId: peerId,
            payload: { type: "candidate", candidate: candidateJson },
          });
        }
      };

      pc.ondatachannel = (event) => {
        configureChannel(peerId, displayName, event.channel);
      };

      return record;
    },
    [socket, configureChannel, onEvent]
  );

  // Auto-connect and negotiate WebRTC for all available LAN peers
  useEffect(() => {
    if (!socket || !selfPeer) {
      return;
    }

    const currentPeerIds = new Set(availablePeers.map((p) => p.id));

    // 1. Cleanup old connections that are no longer online
    for (const [peerId, record] of connectionsRef.current.entries()) {
      if (!currentPeerIds.has(peerId)) {
        record.channel?.close();
        record.pc.close();
        connectionsRef.current.delete(peerId);
        setChannelStates((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    }

    // 2. Setup connections for newly discovered peers
    availablePeers.forEach(async (peer) => {
      if (connectionsRef.current.has(peer.id)) {
        return;
      }

      // Deterministic initiator role assignment based on lexicographical ID sorting to avoid glare/collisions
      const isInitiator = selfPeer.id < peer.id;
      const record = setupPeerConnection(peer.id, peer.displayName, isInitiator);

      if (isInitiator) {
        try {
          const nextChannel = record.pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
          configureChannel(peer.id, peer.displayName, nextChannel);

          const offer = await record.pc.createOffer();
          await record.pc.setLocalDescription(offer);

          socket.emit("signal:send", {
            targetId: peer.id,
            payload: { type: "offer", description: record.pc.localDescription },
          });
          onEvent?.(`Offer sent to ${peer.displayName}.`);
        } catch (err) {
          onEvent?.(`Failed to create offer for ${peer.displayName}: ${err.message}`);
        }
      }
    });
  }, [socket, selfPeer, availablePeers, setupPeerConnection, configureChannel, onEvent]);

  // Handle incoming signaling messages
  useEffect(() => {
    if (!socket || !selfPeer) {
      return;
    }

    const handleSignal = async ({ from, payload, senderIp }) => {
      let record = connectionsRef.current.get(from);
      if (!record) {
        const peerInfo = availablePeers.find((p) => p.id === from);
        const displayName = peerInfo?.displayName || "LAN device";
        record = setupPeerConnection(from, displayName, false);
      }

      const pc = record.pc;

      // Rewrite .local hostnames in SDP and candidates if senderIp is available
      if (senderIp && senderIp !== "127.0.0.1" && senderIp !== "::1") {
        const localHostnameRegex = /[a-zA-Z0-9-]+\.local/g;

        if (payload.description?.sdp) {
          const originalSdp = payload.description.sdp;
          payload.description.sdp = originalSdp.replace(localHostnameRegex, senderIp);
        }

        if (payload.candidate?.candidate) {
          const originalCand = payload.candidate.candidate;
          payload.candidate.candidate = originalCand.replace(localHostnameRegex, senderIp);
        }
      }

      try {
        if (payload.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("signal:send", {
            targetId: from,
            payload: { type: "answer", description: pc.localDescription },
          });

          // Flush pending candidates
          const candidates = record.pendingCandidates.splice(0);
          for (const candidate of candidates) {
            try {
              await pc.addIceCandidate(candidate);
            } catch {}
          }
        } else if (payload.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.description));

          // Flush pending candidates
          const candidates = record.pendingCandidates.splice(0);
          for (const candidate of candidates) {
            try {
              await pc.addIceCandidate(candidate);
            } catch {}
          }
        } else if (payload.type === "candidate") {
          const candidate = new RTCIceCandidate(payload.candidate);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            record.pendingCandidates.push(candidate);
          }
        }
      } catch (err) {
        onEvent?.(`Signaling error with peer ${record.displayName}: ${err.message}`);
      }
    };

    socket.on("signal:receive", handleSignal);
    return () => {
      socket.off("signal:receive", handleSignal);
    };
  }, [socket, selfPeer, availablePeers, setupPeerConnection, onEvent]);

  // Clean up all connections on unmount
  useEffect(() => {
    return () => {
      for (const record of connectionsRef.current.values()) {
        record.channel?.close();
        record.pc.close();
      }
      connectionsRef.current.clear();
      setChannelStates({});
    };
  }, []);

  const getOpenChannels = useCallback(() => {
    const open = [];
    for (const [peerId, record] of connectionsRef.current.entries()) {
      if (record.channel && record.channel.readyState === "open") {
        open.push({ peerId, record });
      }
    }
    return open;
  }, []);

  return {
    channelStates,
    getOpenChannels,
  };
}

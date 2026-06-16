import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_CHANNEL_LABEL, peerConnectionConfig } from "./peerConfig.js";

export function usePeerConnection({
  socket,
  remotePeerId,
  isInitiator,
  onDataMessage,
  onEvent,
}) {
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const [channel, setChannel] = useState(null);
  const [channelState, setChannelState] = useState("closed");
  const [connectionState, setConnectionState] = useState("new");
  const [iceConnectionState, setIceConnectionState] = useState("new");
  const [signalingReady, setSignalingReady] = useState(false);

  const cleanup = useCallback(() => {
    channelRef.current?.close();
    pcRef.current?.close();
    channelRef.current = null;
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    setChannel(null);
    setChannelState("closed");
    setConnectionState("new");
    setIceConnectionState("new");
    setSignalingReady(false);
  }, []);

  const sendSignal = useCallback(
    (payload) => {
      if (!socket || !remotePeerId) {
        return;
      }

      socket.emit("signal:send", {
        targetId: remotePeerId,
        payload,
      });
    },
    [remotePeerId, socket],
  );

  useEffect(() => {
    if (!socket || !remotePeerId) {
      cleanup();
      return undefined;
    }

    let active = true;
    const pc = new RTCPeerConnection(peerConnectionConfig);
    pcRef.current = pc;
    setConnectionState(pc.connectionState);
    setIceConnectionState(pc.iceConnectionState);

    const configureChannel = (nextChannel) => {
      if (!active) {
        nextChannel.close();
        return;
      }

      channelRef.current = nextChannel;
      nextChannel.binaryType = "arraybuffer";
      nextChannel.bufferedAmountLowThreshold = 4 * 1024 * 1024;
      setChannel(nextChannel);
      setChannelState(nextChannel.readyState);

      nextChannel.onopen = () => {
        if (!active) return;
        setChannelState(nextChannel.readyState);
        onEvent?.("Data channel opened.");
      };
      nextChannel.onclose = () => {
        if (!active) return;
        setChannelState(nextChannel.readyState);
        onEvent?.("Data channel closed.");
      };
      nextChannel.onerror = () => onEvent?.("Data channel error.");
      nextChannel.onmessage = (event) => onDataMessage?.(event.data, nextChannel);
    };

    pc.ondatachannel = (event) => configureChannel(event.channel);
    pc.onconnectionstatechange = () => {
      if (!active) return;
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed") {
        onEvent?.("WebRTC connection failed.");
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (!active) return;
      setIceConnectionState(pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        onEvent?.("ICE connection failed.");
      }
    };
    pc.onicecandidate = (event) => {
      if (active && event.candidate) {
        const candidateJson = typeof event.candidate.toJSON === "function"
          ? event.candidate.toJSON()
          : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment,
            };
        sendSignal({ type: "candidate", candidate: candidateJson });
      }
    };

    const flushPendingCandidates = async () => {
      const candidates = pendingCandidatesRef.current.splice(0);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          // ignore or handle candidate addition error quietly
        }
      }
    };

    const handleSignal = async ({ from, payload, senderIp }) => {
      if (!active || from !== remotePeerId || !payload) {
        return;
      }

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
          await flushPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "answer", description: pc.localDescription });
          onEvent?.("Answered peer offer.");
          return;
        }

        if (payload.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
          await flushPendingCandidates();
          onEvent?.("Peer answer received.");
          return;
        }

        if (payload.type === "candidate" && payload.candidate) {
          const candidate = new RTCIceCandidate(payload.candidate);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      } catch (error) {
        onEvent?.(`Peer negotiation failed: ${error.message}`);
      }
    };

    socket.on("signal:receive", handleSignal);
    setSignalingReady(true);

    const startOffer = async () => {
      try {
        const nextChannel = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
        configureChannel(nextChannel);
        if (!active) return;
        const offer = await pc.createOffer();
        if (!active) return;
        await pc.setLocalDescription(offer);
        if (!active) return;
        sendSignal({ type: "offer", description: pc.localDescription });
        onEvent?.("Offer sent.");
      } catch (error) {
        onEvent?.(`Offer failed: ${error.message}`);
      }
    };

    if (isInitiator) {
      startOffer();
    }

    return () => {
      active = false;
      setSignalingReady(false);
      socket.off("signal:receive", handleSignal);
      pc.close();
      channelRef.current?.close();
      if (pcRef.current === pc) {
        pcRef.current = null;
      }
    };
  }, [cleanup, isInitiator, onDataMessage, onEvent, remotePeerId, sendSignal, socket]);

  return {
    channel,
    channelState,
    connectionState,
    iceConnectionState,
    signalingReady,
    resetPeer: cleanup,
  };
}

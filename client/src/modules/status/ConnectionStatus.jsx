import { Wifi, WifiOff } from "lucide-react";

export function ConnectionStatus({
  signalingConnected,
  connectionState,
  iceConnectionState,
  channelState,
}) {
  const ready = signalingConnected && connectionState === "connected" && channelState === "open";
  const warning =
    signalingConnected &&
    ["checking", "connecting", "new"].includes(connectionState || iceConnectionState);

  const className = ready ? "ready" : warning ? "warning" : signalingConnected ? "" : "offline";
  const label = ready
    ? "Direct channel"
    : signalingConnected
      ? `WebRTC ${connectionState}`
      : "Signal offline";

  return (
    <div className={`status-pill ${className}`} title={`ICE: ${iceConnectionState}`}>
      {signalingConnected ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
      <span className="status-dot" />
      <span>{label}</span>
    </div>
  );
}


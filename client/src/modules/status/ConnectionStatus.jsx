import { Wifi, WifiOff } from "lucide-react";

export function ConnectionStatus({
  signalingConnected,
  peerCount,
  connectedCount,
}) {
  const ready = signalingConnected && connectedCount > 0;
  const warning = signalingConnected && peerCount > 0 && connectedCount === 0;

  const className = ready ? "ready" : warning ? "warning" : signalingConnected ? "" : "offline";
  const label = !signalingConnected
    ? "Signal offline"
    : ready
      ? `${connectedCount} ${connectedCount === 1 ? "device" : "devices"} connected`
      : warning
        ? "Connecting..."
        : "0 devices online";

  return (
    <div className={`status-pill ${className}`}>
      {signalingConnected ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
      <span className="status-dot" />
      <span>{label}</span>
    </div>
  );
}


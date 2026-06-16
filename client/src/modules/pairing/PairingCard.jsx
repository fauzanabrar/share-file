import { useState } from "react";
import { Clipboard, DoorOpen, LogIn, Plus } from "lucide-react";

export function PairingCard({
  room,
  roomUrl,
  remotePeerId,
  error,
  disabled,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
}) {
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const submitJoin = (event) => {
    event.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned) {
      onJoinRoom(cleaned);
    }
  };

  const copyRoomUrl = async () => {
    if (!roomUrl || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="panel" aria-label="Room pairing">
      <div className="panel-header">
        <div className="panel-title">
          <LogIn size={19} aria-hidden="true" />
          <h2>Pairing</h2>
        </div>
      </div>

      {room ? (
        <>
          <div className="room-code">
            <span>Room code</span>
            <code>{room.roomCode}</code>
          </div>

          <div className="button-row">
            <button className="button secondary" type="button" onClick={copyRoomUrl}>
              <Clipboard size={17} aria-hidden="true" />
              {copied ? "Copied" : "Copy link"}
            </button>
            <button className="button danger" type="button" onClick={onLeaveRoom}>
              <DoorOpen size={17} aria-hidden="true" />
              Leave
            </button>
          </div>

          <div className="transfer-stack">
            <div className="status-row">
              <span>Local role</span>
              <strong>{room.role}</strong>
            </div>
            <div className="status-row">
              <span>Peer</span>
              <strong>{remotePeerId ? "Connected to room" : "Waiting"}</strong>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="button-row">
            <button className="button" type="button" disabled={disabled} onClick={onCreateRoom}>
              <Plus size={17} aria-hidden="true" />
              Create room
            </button>
          </div>

          <form className="join-form" onSubmit={submitJoin}>
            <input
              type="text"
              value={joinCode}
              placeholder="Room code"
              autoComplete="off"
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <button className="button secondary" type="submit" disabled={disabled}>
              <LogIn size={17} aria-hidden="true" />
              Join
            </button>
          </form>
        </>
      )}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}


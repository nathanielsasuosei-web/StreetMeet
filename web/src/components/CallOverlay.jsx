import { useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import { useCall } from "../state/CallContext.jsx";
import { callDuration } from "../lib/format.js";
import { IconPhone, IconPhoneOff, IconMic, IconMicOff, IconVideo, IconVideoOff } from "./Icons.jsx";

function Video({ stream, muted = false, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

export default function CallOverlay() {
  const call = useCall();
  const { status, type, partner, localStream, remoteStream, seconds } = call;

  if (status === "idle") return null;

  /* ------------------------------ incoming ------------------------------ */
  if (status === "ringing") {
    return (
      <div className="incoming">
        <div className="panel">
          <Avatar user={partner} size="avatar-lg" />
          <h3 style={{ marginTop: 12 }}>{partner?.fullName}</h3>
          <p className="muted small">
            Incoming {type === "VIDEO" ? "video" : "voice"} call…
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
            <button className="call-btn hangup" onClick={call.rejectCall} title="Decline">
              <IconPhoneOff />
            </button>
            <button
              className="call-btn"
              style={{ background: "var(--ok)" }}
              onClick={call.acceptCall}
              title="Accept"
            >
              <IconPhone />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- live -------------------------------- */
  const connected = Boolean(remoteStream && remoteStream.getTracks().length);
  const label =
    status === "calling" ? "Calling…" : connected ? callDuration(seconds) : "Connecting…";

  return (
    <div className="call-overlay">
      <div className="remote">
        {type === "VIDEO" ? (
          remoteStream ? (
            <Video stream={remoteStream} />
          ) : (
            <div className="placeholder">
              <Avatar user={partner} size="avatar-xl" />
              <p className="muted">{label}</p>
            </div>
          )
        ) : (
          <div className="placeholder">
            <Avatar user={partner} size="avatar-xl" />
            <h3 style={{ marginTop: 14 }}>{partner?.fullName}</h3>
            <p className="muted">{label}</p>
          </div>
        )}

        <div className="bar">
          <Avatar user={partner} size="avatar-sm" />
          <div>
            <strong style={{ fontSize: "0.95rem" }}>{partner?.fullName}</strong>
            <div className="tiny muted">{label}</div>
          </div>
        </div>

        {type === "VIDEO" && (
          <div className="local">
            <Video stream={localStream} muted className="" />
          </div>
        )}
      </div>

      <div className="call-controls">
        <button
          className={`call-btn ${call.muted ? "off" : ""}`}
          onClick={call.toggleMute}
          title={call.muted ? "Unmute" : "Mute"}
        >
          {call.muted ? <IconMicOff /> : <IconMic />}
        </button>

        <button className="call-btn hangup" onClick={call.endCall} title="End call">
          <IconPhoneOff />
        </button>

        {type === "VIDEO" && (
          <button
            className={`call-btn ${call.cameraOff ? "off" : ""}`}
            onClick={call.toggleCamera}
            title={call.cameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {call.cameraOff ? <IconVideoOff /> : <IconVideo />}
          </button>
        )}
      </div>
    </div>
  );
}

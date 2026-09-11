import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { callApi } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { Peer, getLocalMedia } from "../lib/webrtc.js";
import { useToast } from "./ToastContext.jsx";
import { useAuth } from "./AuthContext.jsx";

const CallContext = createContext(null);
const IDLE = {
  status: "idle", // idle | calling | ringing | active
  type: "VIDEO",
  callId: null,
  matchId: null,
  partner: null,
  incoming: null,
};

export function CallProvider({ children }) {
  const toast = useToast();
  const { user } = useAuth();
  const [state, setState] = useState(IDLE);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---------------------------------------------------------------------- */

  const cleanup = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setSeconds(0);
    setMuted(false);
    setCameraOff(false);
  }, []);

  const hangUpState = useCallback(() => {
    cleanup();
    setState(IDLE);
  }, [cleanup]);

  /* --------------------------- signalling bus ---------------------------- */

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const onIncoming = ({ callId, matchId, type, offer, from }) => {
      if (stateRef.current.status !== "idle") {
        socket.emit("call:busy", { to: from.id, callId });
        return;
      }
      setState({ status: "ringing", type, callId, matchId, partner: from, incoming: { offer, from } });
    };

    const onAnswered = async ({ callId, answer }) => {
      if (stateRef.current.callId !== callId) return;
      await peerRef.current?.acceptAnswer(answer);
      setState((s) => ({ ...s, status: "active", incoming: null }));
    };

    const onIce = async ({ callId, candidate }) => {
      if (stateRef.current.callId !== callId) return;
      await peerRef.current?.addIceCandidate(candidate);
    };

    const onEnded = () => {
      if (stateRef.current.status === "idle") return;
      toast.info("Call ended");
      hangUpState();
    };

    const onRejected = () => {
      toast.info("They are not available right now");
      hangUpState();
    };

    const onBusy = ({ reason }) => {
      toast.info(reason || "Busy");
      hangUpState();
    };

    const onUnavailable = ({ reason }) => {
      toast.info(reason || "Member is offline");
    };

    const onFailed = ({ reason }) => {
      if (reason) toast.error(reason);
      hangUpState();
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answered", onAnswered);
    socket.on("call:ice", onIce);
    socket.on("call:ended", onEnded);
    socket.on("call:rejected", onRejected);
    socket.on("call:cancelled", onEnded);
    socket.on("call:busy", onBusy);
    socket.on("call:unavailable", onUnavailable);
    socket.on("call:failed", onFailed);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:answered", onAnswered);
      socket.off("call:ice", onIce);
      socket.off("call:ended", onEnded);
      socket.off("call:rejected", onRejected);
      socket.off("call:cancelled", onEnded);
      socket.off("call:busy", onBusy);
      socket.off("call:unavailable", onUnavailable);
      socket.off("call:failed", onFailed);
    };
    // Re-run once the socket exists (it is created by AuthProvider after login)
  }, [hangUpState, toast, user?.id]);

  /* ------------------------------ call timer ----------------------------- */

  useEffect(() => {
    if (state.status !== "active") return undefined;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state.status]);

  /* -------------------------------- API ---------------------------------- */

  const startCall = useCallback(
    async ({ matchId, partner, type = "VIDEO" }) => {
      const socket = socketRef.current;
      if (!socket) return toast.error("Realtime connection not ready yet");

      try {
        const { call } = await callApi.start({ matchId, type });
        const stream = await getLocalMedia(type);
        const { iceServers } = await callApi.ice();

        const peer = new Peer({
          iceServers,
          onRemoteStream: setRemoteStream,
          onIceCandidate: (candidate) => socket.emit("call:ice", { to: partner.id, callId: call.id, candidate }),
          onClose: () => {
            if (stateRef.current.status === "active") hangUpState();
          },
        });
        peerRef.current = peer;

        await peer.addLocalStream(stream);
        setLocalStream(stream);

        const offer = await peer.createOffer();
        setState({ status: "calling", type, callId: call.id, matchId, partner, incoming: null });

        socket.emit("call:initiate", { to: partner.id, matchId, callId: call.id, type, offer });
      } catch (error) {
        toast.error(error.message || "Could not start the call");
        hangUpState();
      }
    },
    [hangUpState, toast]
  );

  const acceptCall = useCallback(async () => {
    const socket = socketRef.current;
    const { incoming, callId, type, matchId, partner } = stateRef.current;
    if (!socket || !incoming) return;

    try {
      const stream = await getLocalMedia(type);
      const { iceServers } = await callApi.ice();

      const peer = new Peer({
        iceServers,
        onRemoteStream: setRemoteStream,
        onIceCandidate: (candidate) => socket.emit("call:ice", { to: partner.id, callId, candidate }),
        onClose: () => {
          if (stateRef.current.status === "active") hangUpState();
        },
      });
      peerRef.current = peer;

      await peer.addLocalStream(stream);
      setLocalStream(stream);

      const answer = await peer.acceptOffer(incoming.offer);
      setState((s) => ({ ...s, status: "active", incoming: null, matchId, partner }));
      socket.emit("call:answer", { to: partner.id, callId, answer });
    } catch (error) {
      toast.error(error.message || "Could not join the call");
      hangUpState();
    }
    // Re-run once the socket exists (it is created by AuthProvider after login)
  }, [hangUpState, toast, user?.id]);

  const rejectCall = useCallback(() => {
    const socket = socketRef.current;
    const { callId, partner } = stateRef.current;
    socket?.emit("call:reject", { to: partner?.id, callId });
    hangUpState();
  }, [hangUpState]);

  const endCall = useCallback(() => {
    const socket = socketRef.current;
    const { callId, partner } = stateRef.current;
    if (callId) {
      socket?.emit("call:end", { to: partner?.id, callId });
      callApi.end(callId).catch(() => {});
    }
    hangUpState();
  }, [hangUpState]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      peerRef.current?.toggleTrack("audio", !current);
      return !current;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOff((current) => {
      peerRef.current?.toggleTrack("video", current);
      return !current;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      localStream,
      remoteStream,
      muted,
      cameraOff,
      seconds,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
    }),
    [state, localStream, remoteStream, muted, cameraOff, seconds, startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used inside <CallProvider>");
  return context;
}

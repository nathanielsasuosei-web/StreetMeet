/**
 * WebRTC calling for React Native.
 *
 * react-native-webrtc ships native code, so this only works in a development
 * build or a production build - NOT in Expo Go. See docs/MOBILE-BUILD.md.
 *
 *   npx expo prebuild && npx expo run:android      (dev build)
 *   eas build -p android --profile preview         (APK you can share)
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  MediaStream,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { callApi } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Profile } from '../lib/api';

type CallStatus = 'idle' | 'calling' | 'ringing' | 'active';
type CallType = 'AUDIO' | 'VIDEO';

type CallValue = {
  status: CallStatus;
  type: CallType;
  partner: Profile | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  seconds: number;
  startCall: (args: { matchId: string; partner: Profile; type: CallType }) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
};

const CallContext = createContext<CallValue | null>(null);

const servers = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [type, setType] = useState<CallType>('VIDEO');
  const [partner, setPartner] = useState<Profile | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pc = useRef<RTCPeerConnection | null>(null);
  const callId = useRef<string | null>(null);
  const matchId = useRef<string | null>(null);
  const offer = useRef<any>(null);
  const stateRef = useRef({ status, partner });
  stateRef.current = { status, partner };

  const stop = useCallback(() => {
    localStream?.getTracks().forEach((track: any) => track.stop());
    pc.current?.close();
    pc.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setSeconds(0);
    setMuted(false);
    setCameraOff(false);
    callId.current = null;
    offer.current = null;
  }, [localStream]);

  const hangUp = useCallback(() => {
    stop();
    setStatus('idle');
    setPartner(null);
  }, [stop]);

  /* --------------------------- signalling wiring -------------------------- */

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onIncoming = (payload: any) => {
      if (stateRef.current.status !== 'idle') {
        socket.emit('call:busy', { to: payload.from.id, callId: payload.callId });
        return;
      }
      callId.current = payload.callId;
      matchId.current = payload.matchId;
      offer.current = payload.offer;
      setType(payload.type);
      setPartner(payload.from);
      setStatus('ringing');
    };

    const onAnswered = async ({ callId: id, answer }: any) => {
      if (callId.current !== id) return;
      await pc.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setStatus('active');
    };

    const onIce = async ({ callId: id, candidate }: any) => {
      if (callId.current !== id) return;
      try {
        await pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore stale candidates */
      }
    };

    const onEnd = () => {
      if (stateRef.current.status === 'idle') return;
      Alert.alert('Call ended');
      hangUp();
    };

    const onRejected = () => {
      Alert.alert('Not available', 'They could not take your call right now');
      hangUp();
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:ice', onIce);
    socket.on('call:ended', onEnd);
    socket.on('call:cancelled', onEnd);
    socket.on('call:rejected', onRejected);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:answered', onAnswered);
      socket.off('call:ice', onIce);
      socket.off('call:ended', onEnd);
      socket.off('call:cancelled', onEnd);
      socket.off('call:rejected', onRejected);
    };
  }, [hangUp]);

  useEffect(() => {
    if (status !== 'active') return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  /* ------------------------------- actions -------------------------------- */

  const buildPeer = useCallback(
    async (forType: CallType) => {
      const socket = getSocket();
      if (!socket) throw new Error('Realtime connection is not ready');

      const stream = (await mediaDevices.getUserMedia({
        audio: true,
        video: forType === 'VIDEO' ? { facingMode: 'user' } : false,
      })) as MediaStream;

      const peer: any = new RTCPeerConnection(servers);
      peer.addStream(stream);

      peer.onaddstream = (event: any) => setRemoteStream(event.stream as MediaStream);
      peer.onicecandidate = (event: any) => {
        if (event.candidate && stateRef.current.partner) {
          socket.emit('call:ice', {
            to: stateRef.current.partner.id,
            callId: callId.current,
            candidate: event.candidate,
          });
        }
      };
      peer.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(peer.connectionState) && stateRef.current.status === 'active') {
          hangUp();
        }
      };

      pc.current = peer;
      setLocalStream(stream);
      return { peer, stream, socket };
    },
    [hangUp]
  );

  const startCall = useCallback(
    async ({ matchId: id, partner: target, type: callType }: { matchId: string; partner: Profile; type: CallType }) => {
      try {
        const { call } = await callApi.start({ matchId: id, type: callType });
        callId.current = call.id;
        matchId.current = id;
        setType(callType);
        setPartner(target);

        const { peer, socket } = await buildPeer(callType);
        const createdOffer = await peer.createOffer({});
        await peer.setLocalDescription(createdOffer);

        setStatus('calling');
        socket.emit('call:initiate', {
          to: target.id,
          matchId: id,
          callId: call.id,
          type: callType,
          offer: peer.localDescription,
        });
      } catch (error: any) {
        Alert.alert('Could not start the call', error?.message ?? 'Unknown error');
        hangUp();
      }
    },
    [buildPeer, hangUp]
  );

  const acceptCall = useCallback(async () => {
    try {
      const { peer, socket } = await buildPeer(type);
      await peer.setRemoteDescription(new RTCSessionDescription(offer.current));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      setStatus('active');
      socket.emit('call:answer', {
        to: stateRef.current.partner?.id,
        callId: callId.current,
        answer: peer.localDescription,
      });
    } catch (error: any) {
      Alert.alert('Could not join the call', error?.message ?? 'Unknown error');
      hangUp();
    }
  }, [buildPeer, hangUp, type]);

  const rejectCall = useCallback(() => {
    const socket = getSocket();
    socket?.emit('call:reject', { to: stateRef.current.partner?.id, callId: callId.current });
    hangUp();
  }, [hangUp]);

  const endCall = useCallback(() => {
    const socket = getSocket();
    socket?.emit('call:end', { to: stateRef.current.partner?.id, callId: callId.current });
    if (callId.current) callApi.end(callId.current).catch(() => {});
    hangUp();
  }, [hangUp]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      localStream?.getAudioTracks().forEach((track: any) => (track.enabled = current));
      return !current;
    });
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    setCameraOff((current) => {
      localStream?.getVideoTracks().forEach((track: any) => (track.enabled = current));
      return !current;
    });
  }, [localStream]);

  const value = useMemo(
    () => ({
      status, type, partner, localStream, remoteStream, muted, cameraOff, seconds,
      startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
    }),
    [status, type, partner, localStream, remoteStream, muted, cameraOff, seconds, startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used inside <CallProvider>');
  return context;
}

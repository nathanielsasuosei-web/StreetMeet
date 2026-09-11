/**
 * Thin WebRTC helper used by the call screen.
 * The server only relays signalling - media flows peer to peer.
 */
export class Peer {
  constructor({ iceServers, onRemoteStream, onIceCandidate, onClose }) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.remoteStream = new MediaStream();
    this.onRemoteStream = onRemoteStream;
    this.onIceCandidate = onIceCandidate;
    this.onClose = onClose;

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => this.remoteStream.addTrack(track));
      if (!this.remoteStream.getTracks().length) {
        event.track && this.remoteStream.addTrack(event.track);
      }
      this.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.onIceCandidate?.(event.candidate);
    };

    this.pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(this.pc.connectionState)) {
        this.onClose?.();
      }
    };
  }

  async addLocalStream(stream) {
    this.localStream = stream;
    stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
  }

  async createOffer() {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription;
  }

  async acceptOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription;
  }

  async acceptAnswer(answer) {
    if (this.pc.signalingState !== "stable") {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async addIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn("ICE candidate failed", error.message);
    }
  }

  toggleTrack(kind, enabled) {
    this.localStream?.getTracks().forEach((track) => {
      if (track.kind === kind) track.enabled = enabled;
    });
  }

  close() {
    this.localStream?.getTracks().forEach((track) => track.stop());
    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

/** Ask the browser for camera + microphone (or microphone only). */
export async function getLocalMedia(type = "VIDEO") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot access the camera or microphone");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === "VIDEO" ? { facingMode: "user", width: { ideal: 1280 } } : false,
  });
}

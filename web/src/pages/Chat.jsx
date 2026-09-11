import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Avatar from "../components/Avatar.jsx";
import { chatApi, matchApi } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { useCall } from "../state/CallContext.jsx";
import { clockTime } from "../lib/format.js";
import { IconSend, IconVideo, IconPhone, IconBack, IconCamera } from "../components/Icons.jsx";

export default function Chat() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const call = useCall();

  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  const socket = useMemo(() => getSocket(), []);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const fileRef = useRef(null);

  /* ----------------------------- load thread ----------------------------- */

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([matchApi.get(matchId), chatApi.messages(matchId)])
      .then(([matchData, messageData]) => {
        if (!active) return;
        setMatch(matchData.match);
        setMessages(messageData.messages || []);
        chatApi.seen(matchId).catch(() => {});
      })
      .catch((error) => toast.error(error.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [matchId, toast]);

  /* ------------------------------ realtime ------------------------------- */

  useEffect(() => {
    if (!socket || !match) return undefined;

    socket.emit("chat:join", { matchId });

    const onMessage = (message) => {
      if (message.matchId !== matchId) return;
      setMessages((current) =>
        current.some((m) => m.id === message.id)
          ? current
          : [...current, { ...message, fromMe: message.senderId === user.id }]
      );
      if (message.senderId !== user.id) chatApi.seen(matchId).catch(() => {});
    };

    const onSeen = ({ matchId: seenMatchId }) => {
      if (seenMatchId !== matchId) return;
      setMessages((current) =>
        current.map((m) => (m.fromMe && !m.seenAt ? { ...m, seenAt: new Date().toISOString() } : m))
      );
    };

    const onTyping = ({ matchId: typingMatchId, userId }) => {
      if (typingMatchId === matchId && userId !== user.id) {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 2500);
      }
    };

    const onStopTyping = ({ matchId: typingMatchId }) => {
      if (typingMatchId === matchId) setTyping(false);
    };

    socket.on("message:new", onMessage);
    socket.on("message:seen", onSeen);
    socket.on("chat:typing", onTyping);
    socket.on("chat:stopTyping", onStopTyping);

    return () => {
      socket.emit("chat:leave", { matchId });
      socket.off("message:new", onMessage);
      socket.off("message:seen", onSeen);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stopTyping", onStopTyping);
    };
  }, [socket, match, matchId, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* -------------------------------- send --------------------------------- */

  const send = async (event) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;

    const optimistic = {
      id: `tmp-${Date.now()}`,
      body,
      mediaType: "TEXT",
      fromMe: true,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((current) => [...current, optimistic]);
    setDraft("");
    socket?.emit("chat:stopTyping", { matchId });

    try {
      const data = await chatApi.send(matchId, { body });
      setMessages((current) => current.map((m) => (m.id === optimistic.id ? { ...data.message } : m)));
    } catch (error) {
      setMessages((current) => current.filter((m) => m.id !== optimistic.id));
      toast.error(error.message);
    }
  };

  const onDraftChange = (value) => {
    setDraft(value);
    if (!socket) return;
    socket.emit("chat:typing", { matchId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("chat:stopTyping", { matchId }), 1500);
  };

  const sendMedia = async (file) => {
    const formData = new FormData();
    formData.append("media", file);
    try {
      const data = await chatApi.sendMedia(matchId, formData);
      setMessages((current) => [...current, data.message]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const partner = match?.partner;

  if (loading) {
    return (
      <div className="loader" style={{ paddingTop: 80 }}>
        <span className="spinner-ring" />
      </div>
    );
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="row">
          <Link to="/app/matches" className="icon-btn">
            <IconBack />
          </Link>
          {partner && <Avatar user={partner} size="avatar-sm" />}
          <div>
            <strong style={{ fontSize: "0.95rem" }}>{partner?.fullName}</strong>
            <div className="tiny muted">{typing ? "typing…" : partner?.city || "natthesisa"}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="icon-btn"
            title="Voice call"
            onClick={() => call.startCall({ matchId, partner, type: "AUDIO" })}
          >
            <IconPhone width={18} height={18} />
          </button>
          <button
            className="icon-btn"
            title="Video call"
            onClick={() => call.startCall({ matchId, partner, type: "VIDEO" })}
          >
            <IconVideo width={18} height={18} />
          </button>
        </div>
      </div>

      <div className="chat-body" style={{ maxHeight: "calc(100vh - 260px)", minHeight: 300 }}>
        {!messages.length && (
          <div className="center muted small" style={{ padding: "30px 10px" }}>
            <div style={{ fontSize: "2rem" }}>💜</div>
            You matched with {partner?.fullName}. Say hello first - it works more often than you think.
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`bubble-row ${message.fromMe ? "me" : "them"}`}>
            {message.mediaType === "IMAGE" && message.mediaUrl ? (
              <div className="bubble media">
                <img src={message.mediaUrl} alt="shared photo" referrerPolicy="no-referrer" />
                <span className="time" style={{ padding: "4px 10px" }}>{clockTime(message.createdAt)}</span>
              </div>
            ) : message.mediaType === "VIDEO" && message.mediaUrl ? (
              <div className="bubble media">
                <video src={message.mediaUrl} controls style={{ maxHeight: 240, borderRadius: 12 }} />
                <span className="time" style={{ padding: "4px 10px" }}>{clockTime(message.createdAt)}</span>
              </div>
            ) : message.mediaType === "AUDIO" && message.mediaUrl ? (
              <div className="bubble">
                <audio src={message.mediaUrl} controls />
                <span className="time">{clockTime(message.createdAt)}</span>
              </div>
            ) : (
              <div className="bubble">
                {message.body}
                <span className="time">
                  {clockTime(message.createdAt)}
                  {message.fromMe && (message.seenAt ? " · seen" : message.pending ? " · sending" : " · sent")}
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="typing">{typing ? `${partner?.fullName?.split(" ")[0]} is typing…` : ""}</div>

      <form className="composer" onSubmit={send}>
        <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} title="Send a photo">
          <IconCamera width={18} height={18} />
        </button>
        <input
          type="file"
          accept="image/*,video/*"
          ref={fileRef}
          style={{ display: "none" }}
          onChange={(event) => event.target.files?.[0] && sendMedia(event.target.files[0])}
        />
        <input
          className="input"
          placeholder="Write a message…"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
          <IconSend width={18} height={18} />
        </button>
      </form>
    </>
  );
}

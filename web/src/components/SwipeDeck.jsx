import { useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { IconHeart, IconBolt, IconStar } from "./Icons.jsx";

/**
 * Swipeable profile deck. Drag with a mouse or a finger, or tap the buttons.
 * Keyboard: ArrowLeft = pass, ArrowRight = like, ArrowUp = super like.
 */
export default function SwipeDeck({ profiles, onLike, onPass, onSuperLike, emptyAction }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const start = useRef({ x: 0, y: 0 });

  const current = profiles[index];
  const next = profiles[index + 1];

  const commit = (direction) => {
    if (!current) return;
    if (direction === "right") onLike?.(current, false);
    if (direction === "left") onPass?.(current);
    if (direction === "up") onSuperLike?.(current);
    setIndex((i) => i + 1);
    setDrag({ x: 0, y: 0, active: false });
  };

  const onPointerDown = (event) => {
    start.current = { x: event.clientX, y: event.clientY };
    setDrag({ x: 0, y: 0, active: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!drag.active) return;
    setDrag((d) => ({ ...d, x: event.clientX - start.current.x, y: event.clientY - start.current.y }));
  };

  const onPointerUp = () => {
    if (!drag.active) return;
    const threshold = 110;
    if (drag.x > threshold) commit("right");
    else if (drag.x < -threshold) commit("left");
    else if (drag.y < -threshold) commit("up");
    else setDrag({ x: 0, y: 0, active: false });
  };

  if (!current) {
    return (
      <div className="empty-deck">
        <div className="emoji">🫶🏾</div>
        <h3>That is everyone for now</h3>
        <p className="small">
          You have seen every profile near you. Widen your distance or come back later - new people join
          every day.
        </p>
        {emptyAction}
      </div>
    );
  }

  const rotation = drag.x / 16;
  const likeOpacity = Math.min(Math.max(drag.x / 110, 0), 1);
  const nopeOpacity = Math.min(Math.max(-drag.x / 110, 0), 1);
  const superOpacity = Math.min(Math.max(-drag.y / 110, 0), 1);

  const cardStyle = (isTop) => ({
    transform: isTop
      ? `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`
      : "translateY(14px) scale(0.96)",
    transition: drag.active ? "none" : "transform 0.25s ease",
    zIndex: isTop ? 3 : 2,
    opacity: isTop ? 1 : 0.9,
    cursor: "grab",
  });

  return (
    <>
      <div className="deck">
        {next && (
          <div className="swipe-card" style={cardStyle(false)}>
            <img src={next.photos?.[0] || next.avatarUrl} alt={next.fullName} />
          </div>
        )}

        <div
          className="swipe-card"
          style={cardStyle(true)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img src={current.photos?.[0] || current.avatarUrl} alt={current.fullName} draggable="false" />

          <div className="swipe-stamp" style={{ opacity: likeOpacity }}>
            LIKE
          </div>
          <div className="swipe-stamp nope" style={{ opacity: nopeOpacity }}>
            NOPE
          </div>
          <div className="swipe-stamp super" style={{ opacity: superOpacity }}>
            SUPER ⭐
          </div>

          <div className="overlay">
            <h2>
              {current.fullName}
              {current.age ? `, ${current.age}` : ""}
              {current.verified ? " ✅" : ""}
            </h2>
            <div className="meta">
              <span>📍 {current.city || "Ghana"}</span>
              {current.distanceKm != null && <span>· {current.distanceKm} km away</span>}
            </div>
            {current.bio && <p className="bio">{current.bio}</p>}
            {!!current.interests?.length && (
              <div className="chips">
                {current.interests.slice(0, 4).map((interest) => (
                  <span key={interest} className="chip">
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="deck-actions">
        <button className="deck-btn small" onClick={() => commit("up")} title="Super like">
          <IconStar />
        </button>
        <button className="deck-btn nope" onClick={() => commit("left")} title="Pass">
          ✕
        </button>
        <button className="deck-btn super" onClick={() => commit("up")} title="Boost">
          <IconBolt />
        </button>
        <button className="deck-btn like" onClick={() => commit("right")} title="Like">
          <IconHeart />
        </button>
        <button className="deck-btn small" onClick={() => commit("right")} title="Like">
          ⭐
        </button>
      </div>
    </>
  );
}

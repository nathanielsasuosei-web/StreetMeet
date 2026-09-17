import { useNavigate } from 'react-router-dom'

import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

/** The "It's a match!" celebration after a mutual like. */
export function MatchModal({ match, onClose }) {
  const navigate = useNavigate()
  if (!match) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="It's a match">
      <div className="modal match-modal">
        <div className="match-modal-heart" aria-hidden="true">
          💘
        </div>
        <h2>It&apos;s a match!</h2>
        <p className="card-desc">
          You and <strong className="strong">{match.partner.firstName}</strong> liked each other.
          Say something nice - first messages matter.
        </p>
        <div className="match-modal-avatars">
          <Avatar src={match.me?.profileImage} name={match.me?.fullName || 'You'} size="lg" />
          <span className="match-modal-link" aria-hidden="true">
            ♥
          </span>
          <Avatar src={match.partner.profileImage} name={match.partner.fullName} size="lg" />
        </div>
        <div className="match-modal-actions">
          <Button
            variant="accent"
            onClick={() => {
              onClose()
              navigate(`/matches/${match.matchId}`)
            }}
          >
            Send a message
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Keep discovering
          </Button>
        </div>
      </div>
    </div>
  )
}

export default MatchModal

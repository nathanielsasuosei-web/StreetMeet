import { Avatar } from './ui/Avatar'
import { Chip } from './ui/Chip'
import { labelFor } from '../lib/format'

/**
 * The discovery card: photo, name + age, location, goal and a few interests.
 * `actions` renders the like/pass (or any) controls under the visual.
 */
export function ProfileCard({ card, actions, onOpen, compact = false }) {
  return (
    <article className={`profile-card${compact ? ' profile-card-compact' : ''}`}>
      <button
        type="button"
        className="profile-card-media"
        onClick={onOpen}
        aria-label={`View ${card.fullName}'s profile`}
      >
        {card.profileImage ? (
          <img src={card.profileImage} alt={`${card.fullName}'s profile photo`} loading="lazy" />
        ) : (
          <span className="profile-card-fallback">
            <Avatar name={card.fullName} size="xl" empty />
          </span>
        )}
        <span className="profile-card-overlay">
          {card.badge ? <span className="badge badge-vip">{card.badge}</span> : null}
          <strong>
            {card.firstName}
            {card.age ? `, ${card.age}` : ''}
          </strong>
          {card.location ? <span className="tiny">{card.location}</span> : null}
        </span>
      </button>

      {!compact ? (
        <div className="profile-card-body">
          {card.relationshipGoal ? (
            <span className="badge badge-goal">{labelFor(card.relationshipGoal)}</span>
          ) : null}
          {card.bio ? <p className="card-desc clamp-3">{card.bio}</p> : null}
          {card.interests?.length ? (
            <div className="chip-row">
              {card.interests.slice(0, 4).map((slug) => (
                <Chip key={slug} size="sm" disabled>
                  {labelFor(slug)}
                </Chip>
              ))}
              {card.interests.length > 4 ? (
                <span className="tiny muted">+{card.interests.length - 4}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {actions ? <div className="profile-card-actions">{actions}</div> : null}
    </article>
  )
}

export default ProfileCard

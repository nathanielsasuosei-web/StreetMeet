import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Avatar } from '../components/ui/Avatar'
import { Card, CardBody } from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

const POLL_MS = 15_000

/** My matches: newest activity first, with unread badges and previews. */
export function Matches() {
  const { profileComplete } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.matches.list()
      setItems(data.items)
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load your matches.')
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  return (
    <div className="container section narrow">
      <div className="page-head">
        <div>
          <h1>Matches</h1>
          <p className="card-desc">Mutual likes become conversations. Say hi first - it works.</p>
        </div>
        <Link className="btn btn-accent" to="/discover">
          Discover people
        </Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {!items && !error ? <p className="muted">Loading your matches…</p> : null}

      {items && !items.length ? (
        <Card>
          <CardBody style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }} aria-hidden="true">
              💫
            </div>
            <h3>No matches yet</h3>
            <p className="card-desc">
              {profileComplete
                ? 'Like a few people in the deck - when the feeling is mutual you will see them here.'
                : 'Finish your profile first, then the deck opens up.'}
            </p>
            {profileComplete ? (
              <Link className="btn btn-accent" to="/discover">
                Open the deck
              </Link>
            ) : (
              <Link className="btn btn-accent" to="/onboarding">
                Finish profile
              </Link>
            )}
          </CardBody>
        </Card>
      ) : null}

      {items?.length ? (
        <ul className="match-list">
          {items.map((match) => (
            <li key={match.id}>
              <Link className="match-row" to={`/matches/${match.id}`}>
                <Avatar src={match.partner.profileImage} name={match.partner.fullName} size="lg" />
                <span className="match-row-main">
                  <strong>
                    {match.partner.firstName}
                    {match.partner.age ? `, ${match.partner.age}` : ''}
                  </strong>
                  <span className={`match-row-preview${match.unread ? ' strong' : ''}`}>
                    {match.lastMessage
                      ? `${match.lastMessage.mine ? 'You: ' : ''}${match.lastMessage.content}`
                      : 'New match - send the first message!'}
                  </span>
                </span>
                <span className="match-row-meta">
                  <span className="tiny muted">
                    {timeAgo(match.lastMessage?.createdAt || match.createdAt)}
                  </span>
                  {match.unread ? <span className="badge badge-unread">{match.unread}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default Matches

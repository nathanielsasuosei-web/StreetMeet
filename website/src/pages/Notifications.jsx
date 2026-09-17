import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

const ICONS = { LIKE: '♥', MATCH: '💘', MESSAGE: '💬', ANNOUNCEMENT: '📣' }

function textFor(notification) {
  const who = notification.actor?.name || 'Someone'
  if (notification.type === 'ANNOUNCEMENT') {
    const title = notification.payload?.title || 'Announcement'
    const body = notification.payload?.body
    return body ? `${title} - ${body}` : title
  }
  if (notification.type === 'LIKE') return `${who} liked you.`
  if (notification.type === 'MATCH') return `You matched with ${who}!`
  const preview = notification.payload?.preview
  return preview ? `${who}: “${preview}”` : `${who} sent you a message.`
}

/** In-app notification centre: likes, matches and messages. */
export function Notifications() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api.notifications.list(30))
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load notifications.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function open(notification) {
    if (!notification.readAt) {
      api.notifications.readOne(notification.id).catch(() => {})
      window.dispatchEvent(new window.Event('streetmeet:notifications'))
    }
    if (notification.type === 'ANNOUNCEMENT') {
      /* announcements are read in place - nothing to open */
    } else if (notification.type === 'LIKE') navigate('/discover')
    else if (notification.matchId) navigate(`/matches/${notification.matchId}`)
    else navigate('/matches')
    setData((current) => ({
      ...current,
      unread: Math.max(0, current.unread - (notification.readAt ? 0 : 1)),
      items: current.items.map((item) =>
        item.id === notification.id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item,
      ),
    }))
  }

  async function markAll() {
    setBusy(true)
    try {
      await api.notifications.readAll()
      window.dispatchEvent(new window.Event('streetmeet:notifications'))
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container section narrow">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="card-desc">Likes, matches and new messages in one place.</p>
        </div>
        {data?.unread ? (
          <Button variant="ghost" onClick={markAll} loading={busy}>
            Mark all read
          </Button>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {!data && !error ? <p className="muted">Loading…</p> : null}

      {data && !data.items.length ? (
        <Card>
          <CardBody style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }} aria-hidden="true">
              🔕
            </div>
            <h3>Nothing yet</h3>
            <p className="card-desc">When someone likes you or answers a message, it lands here.</p>
          </CardBody>
        </Card>
      ) : null}

      {data?.items?.length ? (
        <ul className="notification-list">
          {data.items.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={`notification-row${notification.readAt ? '' : ' unread'}`}
                onClick={() => open(notification)}
              >
                <span className="notification-icon" aria-hidden="true">
                  {ICONS[notification.type] || '•'}
                </span>
                {notification.actor ? (
                  <Avatar src={notification.actor.image} name={notification.actor.name} size="md" />
                ) : (
                  <Avatar name="StreetMeet" size="md" />
                )}
                <span className="notification-main">
                  <span>{textFor(notification)}</span>
                  <span className="tiny muted">{timeAgo(notification.createdAt)}</span>
                </span>
                {!notification.readAt ? <span className="notification-dot" aria-label="Unread" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default Notifications

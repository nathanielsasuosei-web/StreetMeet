import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHead } from '../../components/ui/Card'
import { Field, TextArea, TextInput } from '../../components/ui/Field'
import { useToast } from '../../hooks/useToast'
import { api } from '../../lib/api'
import { timeAgo } from '../../lib/format'

/** Broadcast announcements to every member's notification centre. */
export function AnnouncementsTab() {
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.admin.announcements()
      setItems(data.items)
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load announcements.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function send(event) {
    event.preventDefault()
    setSending(true)
    try {
      const sent = await api.admin.announce({ title, body })
      toast.success(`Announcement delivered to ${sent.deliveredTo} member(s).`)
      setTitle('')
      setBody('')
      await load()
    } catch (cause) {
      toast.error(cause?.fields?.title || cause?.fields?.body || cause?.message || 'Could not send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHead
        title="Announcements"
        description="Every member (except suspended, banned, deactivated accounts and other admins) gets this in their notification centre."
      />
      <CardBody>
        <form className="admin-announce-form" onSubmit={send}>
          <Field label="Title">
            <TextInput
              value={title}
              placeholder="e.g. Safety week starts Monday"
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Message" counter={`${body.length}/1000`}>
            <TextArea
              value={body}
              rows={4}
              placeholder="What should every member know?"
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="accent" loading={sending} disabled={title.trim().length < 3 || body.trim().length < 3}>
            📣 Send announcement
          </Button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}

        {items?.length ? (
          <ul className="admin-list admin-announcements">
            {items.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.title}</strong>
                <p className="muted">{entry.body}</p>
                <span className="tiny muted">
                  {entry.author?.fullName ? `${entry.author.fullName} · ` : ''}
                  {timeAgo(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {items && !items.length ? <p className="muted">Nothing announced yet.</p> : null}
      </CardBody>
    </Card>
  )
}

export default AnnouncementsTab

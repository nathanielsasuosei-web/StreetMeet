import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ReportDialog } from '../components/ReportDialog'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../hooks/useToast'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

const POLL_MS = 4000

/** One match thread: history, live-ish polling, composer and safety menu. */
export function Conversation() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [match, setMatch] = useState(null)
  const [messages, setMessages] = useState([])
  const [state, setState] = useState('loading')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'block' | 'unmatch'
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)
  const latestId = useRef(null)

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const data = await api.matches.messages(matchId, { limit: 100 })
        setMessages(data.items)
        setState('ready')
        // opening a thread with unread partner messages counts as reading them
        if (data.items.some((message) => !message.mine && !message.seen)) {
          api.matches.markRead(matchId).catch(() => {})
          setMessages((current) => current.map((message) => (message.mine ? message : { ...message, seen: true })))
        }
        const last = data.items.at(-1)
        if (last && last.id !== latestId.current) {
          latestId.current = last.id
        }
      } catch (cause) {
        if (cause?.status === 404) {
          setState('gone')
          return
        }
        if (!silent) setState('error')
      }
    },
    [matchId],
  )

  useEffect(() => {
    let active = true
    api.matches
      .get(matchId)
      .then((data) => {
        if (active) setMatch(data)
      })
      .catch(() => {
        if (active) setState('gone')
      })
    return () => {
      active = false
    }
  }, [matchId])

  useEffect(() => {
    refresh()
    const timer = setInterval(() => refresh({ silent: false }), POLL_MS)
    const onFocus = () => {
      refresh()
      api.matches.markRead(matchId).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [matchId, refresh])

  useEffect(() => {
    // optional call: some DOM implementations (jsdom in tests) lack it
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.length])

  async function send(event) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const message = await api.matches.send(matchId, content)
      setMessages((current) => [...current, message])
      latestId.current = message.id
      setDraft('')
    } catch (cause) {
      toast.error(cause?.message || 'Message did not send.')
      if (cause?.status === 404) setState('gone')
    } finally {
      setSending(false)
    }
  }

  async function runConfirm() {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm === 'block') {
        await api.moderation.block(match.partner.id)
        toast.success('Blocked. They can no longer see you or message you.')
      } else {
        await api.matches.unmatch(matchId)
        toast.success('Unmatched. The conversation is closed for both of you.')
      }
      navigate('/matches')
    } catch (cause) {
      toast.error(cause?.message || 'Could not do that right now.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  if (state === 'gone') {
    return (
      <div className="container section narrow">
        <h1>Conversation unavailable</h1>
        <p className="card-desc">This match no longer exists (unmatched or blocked).</p>
        <Link className="btn" to="/matches">
          Back to matches
        </Link>
      </div>
    )
  }

  return (
    <div className="container section conversation-page">
      <header className="conversation-head">
        <Link className="btn btn-ghost btn-sm" to="/matches" aria-label="Back to matches">
          ←
        </Link>
        {match?.partner ? (
          <span className="conversation-title">
            <Avatar src={match.partner.profileImage} name={match.partner.fullName} size="sm" />
            <strong>
              {match.partner.firstName}
              {match.partner.age ? `, ${match.partner.age}` : ''}
            </strong>
          </span>
        ) : (
          <span className="muted">Loading…</span>
        )}
        <span style={{ position: 'relative' }}>
          <Button variant="ghost" size="sm" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen}>
            ⋯
          </Button>
          {menuOpen && match?.partner ? (
            <div className="card conversation-menu" role="menu">
              <button type="button" role="menuitem" className="tab" onClick={() => { setMenuOpen(false); setReporting(true) }}>
                Report member
              </button>
              <button type="button" role="menuitem" className="tab" onClick={() => { setMenuOpen(false); setConfirm('block') }}>
                Block member
              </button>
              <button
                type="button"
                role="menuitem"
                className="tab"
                style={{ color: 'var(--danger)' }}
                onClick={() => { setMenuOpen(false); setConfirm('unmatch') }}
              >
                Unmatch
              </button>
            </div>
          ) : null}
        </span>
      </header>

      <div className="conversation-thread" aria-live="polite">
        {state === 'loading' ? <p className="muted">Loading conversation…</p> : null}
        {state === 'ready' && !messages.length ? (
          <p className="muted" style={{ textAlign: 'center' }}>
            You matched! Break the ice - mention something from their profile.
          </p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={`bubble-row${message.mine ? ' mine' : ''}`}>
            <div className={`bubble${message.mine ? ' bubble-mine' : ''}`}>
              <p>{message.content}</p>
              <span className="tiny muted" title={formatDateTime(message.createdAt)}>
                {formatDateTime(message.createdAt)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="conversation-composer" onSubmit={send}>
        <textarea
          value={draft}
          rows={1}
          maxLength={1000}
          placeholder={`Message ${match?.partner?.firstName || 'your match'}…`}
          aria-label="Message"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
        />
        <Button type="submit" variant="accent" loading={sending} disabled={!draft.trim()}>
          Send
        </Button>
      </form>

      {reporting && match?.partner ? (
        <ReportDialog target={match.partner} onClose={() => setReporting(false)} />
      ) : null}

      {confirm ? (
        <Modal
          open
          title={confirm === 'block' ? `Block ${match?.partner?.firstName}?` : 'Unmatch?'}
          description={
            confirm === 'block'
              ? 'They lose access to you entirely: no deck, no match, no messages.'
              : 'The match and the whole conversation are removed for both of you.'
          }
          confirmLabel={confirm === 'block' ? 'Block' : 'Unmatch'}
          variant="danger"
          busy={busy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  )
}

export default Conversation

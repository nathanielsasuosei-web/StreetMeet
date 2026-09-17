import { useCallback, useEffect, useState } from 'react'

import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { api } from '../../lib/api'
import { cx, formatDate } from '../../lib/format'

const STATUS_OPTIONS = [
  { value: '', label: 'Everyone' },
  { value: 'OK', label: 'In good standing' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
]

/** Member directory: search, verify, feature, suspend, ban, reinstate, roles. */
export function MembersTab() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [banning, setBanning] = useState(null)
  const [banNote, setBanNote] = useState('')

  const load = useCallback(async (query = q, filter = status, page = data?.page ?? 1) => {
    try {
      setData(
        await api.admin.members({
          q: query || undefined,
          status: filter || undefined,
          page,
          limit: 10,
        }),
      )
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load members.')
    }
  }, [q, status, data?.page])

  useEffect(() => {
    load('', '', 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function act(member, fn, message) {
    setBusyId(member.id)
    try {
      await fn(member)
      toast.success(message)
      await load()
    } catch (cause) {
      toast.error(cause?.message || 'That action failed.')
    } finally {
      setBusyId(null)
    }
  }

  function submitSearch(event) {
    event.preventDefault()
    load(q, status, 1)
  }

  return (
    <Card>
      <CardBody>
        <form className="admin-toolbar" onSubmit={submitSearch}>
          <TextInput
            value={q}
            placeholder="Search name, email or city"
            onChange={(event) => setQ(event.target.value)}
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="ghost">
            Search
          </Button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        {!data && !error ? <p className="muted">Loading members…</p> : null}

        {data ? (
          <>
            <ul className="admin-members">
              {data.items.map((member) => (
                <li key={member.id} className="admin-member">
                  <Avatar src={member.profileImage} name={member.fullName} size="md" verified={member.verified} />
                  <div className="admin-member-main">
                    <strong>
                      {member.fullName}
                      {member.featuredAt ? <span title="Featured profile"> ⭐</span> : null}
                    </strong>
                    <span className="tiny muted">
                      {member.email}
                      {member.city ? ` · ${member.city}` : ''} · joined {formatDate(member.createdAt)}
                    </span>
                    <span className="row admin-member-badges">
                      {member.role !== 'USER' ? <span className="badge badge-brand">{member.role}</span> : null}
                      {member.verified ? <span className="badge badge-info">✓ verified</span> : null}
                      {member.accountStatus !== 'OK' ? (
                        <span className="badge badge-danger">{member.accountStatus}</span>
                      ) : null}
                      {member.deactivatedAt ? <span className="badge badge-info">DEACTIVATED</span> : null}
                      {member.moderationNote ? (
                        <span className="tiny muted" title={member.moderationNote}>
                          note: {member.moderationNote}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="admin-member-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === member.id}
                      onClick={() =>
                        act(
                          member,
                          (row) => api.admin.verify(row.id, !row.verified),
                          member.verified ? 'Verification removed.' : 'Profile verified.',
                        )
                      }
                    >
                      {member.verified ? 'Unverify' : 'Verify'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === member.id}
                      onClick={() =>
                        act(
                          member,
                          (row) => api.admin.feature(row.id, !row.featuredAt),
                          member.featuredAt ? 'Feature removed.' : 'Profile featured.',
                        )
                      }
                    >
                      {member.featuredAt ? 'Unfeature' : 'Feature'}
                    </Button>
                    {member.accountStatus === 'OK' && !member.deactivatedAt ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === member.id || member.id === me?.id}
                          onClick={() =>
                            act(member, (row) => api.admin.suspend(row.id), 'Account suspended.')
                          }
                        >
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === member.id || member.id === me?.id}
                          onClick={() => {
                            setBanning(member)
                            setBanNote('')
                          }}
                        >
                          Ban
                        </Button>
                      </>
                    ) : null}
                    {member.accountStatus !== 'OK' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === member.id}
                        onClick={() => act(member, (row) => api.admin.reinstate(row.id), 'Account reinstated.')}
                      >
                        Reinstate
                      </Button>
                    ) : null}
                    {member.id !== me?.id && member.role !== 'ADMIN' ? (
                      <Select
                        value={member.role}
                        onChange={(event) =>
                          act(
                            member,
                            (row) => api.admin.setRole(row.id, event.target.value),
                            `Role set to ${event.target.value}.`,
                          )
                        }
                      >
                        <option value="USER">USER</option>
                        <option value="MODERATOR">MODERATOR</option>
                      </Select>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <div className="admin-pagination">
              <Button
                size="sm"
                variant="ghost"
                disabled={data.page <= 1}
                onClick={() => load(q, status, data.page - 1)}
              >
                ← Previous
              </Button>
              <span className={cx('tiny muted')}>
                Page {data.page} of {data.pages} · {data.total} member(s)
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={data.page >= data.pages}
                onClick={() => load(q, status, data.page + 1)}
              >
                Next →
              </Button>
            </div>
          </>
        ) : null}
      </CardBody>

      {banning ? (
        <Modal
          open
          title={`Ban ${banning.fullName}?`}
          description="A ban blocks login and every existing session immediately. The note is stored on the account."
          confirmLabel="Ban account"
          variant="danger"
          busy={busyId === banning.id}
          onConfirm={async () => {
            const target = banning
            setBanning(null)
            await act(target, (row) => api.admin.ban(row.id, banNote || undefined), 'Account banned.')
          }}
          onClose={() => setBanning(null)}
        >
          <Field label="Moderation note" optional>
            <TextInput
              value={banNote}
              placeholder="Why is this account being banned?"
              onChange={(event) => setBanNote(event.target.value)}
            />
          </Field>
        </Modal>
      ) : null}
    </Card>
  )
}

export default MembersTab

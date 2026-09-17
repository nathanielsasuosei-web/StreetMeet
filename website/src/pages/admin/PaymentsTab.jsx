import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHead } from '../../components/ui/Card'
import { Select, TextInput } from '../../components/ui/Field'
import { useToast } from '../../hooks/useToast'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
]

/** Subscription manager + payments ledger (one and the same table). */
export function PaymentsTab() {
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async (nextStatus = status, nextQ = q) => {
    try {
      const data = await api.admin.subscriptions({
        status: nextStatus || undefined,
        q: nextQ || undefined,
        limit: 100,
      })
      setItems(data.items)
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load the ledger.')
    }
  }, [status, q])

  useEffect(() => {
    load('', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function terminate(row) {
    setBusyId(row.id)
    try {
      await api.admin.terminateSubscription(row.id)
      toast.success(`Subscription for ${row.user.fullName} terminated.`)
      await load()
    } catch (cause) {
      toast.error(cause?.message || 'Could not terminate the subscription.')
    } finally {
      setBusyId(null)
    }
  }

  function submitSearch(event) {
    event.preventDefault()
    load(status, q)
  }

  return (
    <Card>
      <CardHead
        title="Subscriptions & payments"
        description="Every Paystack charge - pending, active, expired or failed. Terminating ends the paid window immediately."
      />
      <CardBody>
        <form className="admin-toolbar" onSubmit={submitSearch}>
          <TextInput
            value={q}
            placeholder="Search member or reference"
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
        {!items && !error ? <p className="muted">Loading the ledger…</p> : null}
        {items?.length === 0 ? <p className="muted">No subscriptions match those filters.</p> : null}

        {items?.length ? (
          <ul className="admin-list admin-ledger">
            {items.map((row) => (
              <li key={row.id}>
                <div className="admin-ledger-main">
                  <strong>
                    {row.user.fullName}{' '}
                    <span className="tiny muted">{row.user.email}</span>
                  </strong>
                  <span className="tiny muted">
                    {row.plan} · GHS {row.amountGhs} · {row.channel === 'mobile_money' ? `momo${row.provider ? ` (${row.provider})` : ''}${row.phone ? ` ${row.phone}` : ''}` : 'card'} ·{' '}
                    <code>{row.reference}</code>
                  </span>
                  <span className="tiny muted">
                    {row.startedAt ? `${formatDate(row.startedAt)} → ${formatDate(row.expiresAt)}` : `created ${formatDate(row.createdAt)} · awaiting payment`}
                  </span>
                </div>
                <span className={`badge ${row.active ? 'badge-brand' : row.status === 'FAILED' ? 'badge-danger' : 'badge-info'}`}>
                  {row.status}
                </span>
                {row.status === 'ACTIVE' ? (
                  <Button size="sm" variant="danger" loading={busyId === row.id} onClick={() => terminate(row)}>
                    Terminate
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  )
}

export default PaymentsTab

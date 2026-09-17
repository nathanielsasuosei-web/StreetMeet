import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHead } from '../../components/ui/Card'
import { Select, TextInput } from '../../components/ui/Field'
import { useToast } from '../../hooks/useToast'
import { api } from '../../lib/api'
import { timeAgo } from '../../lib/format'

const RESOLUTIONS = [
  { value: 'DISMISSED', label: 'Dismiss - no action needed' },
  { value: 'WARNED', label: 'Warn the member' },
  { value: 'SUSPENDED', label: 'Suspend the member' },
  { value: 'BANNED', label: 'Ban the member' },
]

/** Review queue for reported accounts. */
export function ReportsTab() {
  const toast = useToast()
  const [filter, setFilter] = useState('OPEN')
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async (nextFilter = filter) => {
    try {
      const data = await api.admin.reports(nextFilter || undefined)
      setItems(data.items)
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load reports.')
    }
  }, [filter])

  useEffect(() => {
    load(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function resolve(report) {
    const draft = drafts[report.id] || { resolution: 'DISMISSED', note: '' }
    setBusyId(report.id)
    try {
      await api.admin.resolveReport(report.id, {
        resolution: draft.resolution,
        note: draft.note || undefined,
      })
      toast.success(`Report resolved (${draft.resolution}).`)
      await load()
    } catch (cause) {
      toast.error(cause?.message || 'Could not resolve the report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHead
        title="Reported accounts"
        description="Resolving with a sanction applies it to the reported member immediately."
        action={
          <div className="segmented" role="tablist" aria-label="Report status">
            {['OPEN', 'RESOLVED'].map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={filter === entry}
                className={`segmented-item${filter === entry ? ' active' : ''}`}
                onClick={() => setFilter(entry)}
              >
                {entry === 'OPEN' ? 'Open queue' : 'Resolved'}
              </button>
            ))}
          </div>
        }
      />
      <CardBody>
        {error ? <p className="error-text">{error}</p> : null}
        {!items && !error ? <p className="muted">Loading reports…</p> : null}
        {items?.length === 0 ? (
          <p className="muted">
            {filter === 'OPEN' ? 'No open reports - the community is behaving.' : 'Nothing resolved yet.'}
          </p>
        ) : null}

        <ul className="admin-list admin-reports">
          {items?.map((report) => {
            const draft = drafts[report.id] || { resolution: 'DISMISSED', note: '' }
            return (
              <li key={report.id} className="admin-report">
                <div className="admin-report-head">
                  <span className="badge badge-danger">{report.reason.replaceAll('_', ' ')}</span>
                  <span className={report.status === 'OPEN' ? 'badge badge-warn' : 'badge badge-info'}>
                    {report.status}
                  </span>
                  <span className="tiny muted">{timeAgo(report.createdAt)}</span>
                </div>
                <p className="admin-report-parties">
                  <strong>{report.reporter.fullName}</strong>{' '}
                  <span className="tiny muted">({report.reporter.email})</span> reported{' '}
                  <strong>{report.target.fullName}</strong>{' '}
                  <span className="tiny muted">({report.target.email})</span>
                  {report.target.accountStatus !== 'OK' ? (
                    <span className="badge badge-danger">{report.target.accountStatus}</span>
                  ) : null}
                </p>
                {report.details ? <p className="muted">“{report.details}”</p> : null}

                {report.status === 'OPEN' ? (
                  <div className="admin-toolbar">
                    <Select
                      value={draft.resolution}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [report.id]: { ...draft, resolution: event.target.value },
                        }))
                      }
                    >
                      {RESOLUTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      value={draft.note}
                      placeholder="Note (stored with the resolution)"
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [report.id]: { ...draft, note: event.target.value },
                        }))
                      }
                    />
                    <Button size="sm" loading={busyId === report.id} onClick={() => resolve(report)}>
                      Resolve
                    </Button>
                  </div>
                ) : (
                  <p className="tiny muted">
                    Resolved as <strong>{report.resolution}</strong>
                    {report.resolvedBy ? ` by ${report.resolvedBy.fullName}` : ''}
                    {report.resolutionNote ? ` - “${report.resolutionNote}”` : ''}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

export default ReportsTab

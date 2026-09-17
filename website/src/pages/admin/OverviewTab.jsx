import { useEffect, useState } from 'react'

import { Card, CardBody, CardHead } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'

function StatTile({ label, value, hint }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <strong>{label}</strong>
      {hint ? <span className="tiny muted">{hint}</span> : null}
    </div>
  )
}

function BarChart({ title, data, suffix = '' }) {
  const max = Math.max(...data.map((entry) => entry.count), 1)
  return (
    <Card>
      <CardHead title={title} description="Last 14 days" />
      <CardBody>
        <div className="bar-chart" role="img" aria-label={`${title}, last 14 days`}>
          {data.map((entry) => (
            <div key={entry.day} className="bar-slot" title={`${entry.day}: ${entry.count}${suffix}`}>
              <div className="bar" style={{ height: `${Math.round((entry.count / max) * 100)}%` }} />
              <span className="tiny muted">{entry.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

/** Platform statistics: totals, activity charts and the latest movement. */
export function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    api.admin
      .stats()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch((cause) => {
        if (active) setError(cause?.message || 'Could not load statistics.')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <p className="error-text">{error}</p>
  if (!stats) return <p className="muted">Crunching numbers…</p>

  const totals = stats.totals
  return (
    <div className="admin-overview">
      <div className="stat-grid">
        <StatTile label="Members" value={totals.members} hint={`${totals.deactivated} deactivated`} />
        <StatTile label="Verified profiles" value={totals.verified} />
        <StatTile label="New today" value={totals.newToday} hint={`${totals.newWeek} this week`} />
        <StatTile label="Matches" value={totals.matches} hint={`${totals.likes} likes · ${totals.messages} messages`} />
        <StatTile label="Open reports" value={totals.openReports} />
        <StatTile
          label="Active subscriptions"
          value={totals.activeSubscriptions}
          hint={`${totals.premiumActive} Premium · ${totals.vipActive} VIP`}
        />
        <StatTile label="Revenue" value={`GHS ${totals.revenueGhs.toFixed(2)}`} hint="paid windows" />
        <StatTile
          label="Moderated"
          value={totals.suspended + totals.banned}
          hint={`${totals.suspended} suspended · ${totals.banned} banned · ${totals.featured} featured`}
        />
      </div>

      <div className="admin-charts">
        <BarChart title="Registrations" data={stats.registrations} />
        <BarChart title="Subscription activity" data={stats.subscriptionActivity} />
      </div>

      <div className="admin-columns">
        <Card>
          <CardHead title="Newest members" />
          <CardBody>
            <ul className="admin-list">
              {stats.recentMembers.map((member) => (
                <li key={member.id}>
                  <strong>{member.fullName}</strong>
                  <span className="tiny muted">{member.email}</span>
                  <span className="tiny muted">{formatDate(member.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Latest payments" />
          <CardBody>
            {stats.recentPayments.length ? (
              <ul className="admin-list">
                {stats.recentPayments.map((row) => (
                  <li key={row.id}>
                    <strong>{row.user.fullName}</strong>
                    <span className="tiny muted">
                      {row.plan} · GHS {row.amountGhs}
                    </span>
                    <span className={`badge ${row.status === 'ACTIVE' ? 'badge-brand' : 'badge-info'}`}>
                      {row.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No payments yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Community mix" />
          <CardBody>
            <ul className="admin-list">
              {stats.genders.map((entry) => (
                <li key={entry.gender}>
                  <strong>{entry.gender.replaceAll('_', ' ').toLowerCase()}</strong>
                  <span className="tiny muted">{entry.count} member(s)</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default OverviewTab

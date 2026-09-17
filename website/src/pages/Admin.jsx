import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { AnnouncementsTab } from './admin/AnnouncementsTab'
import { InterestsTab } from './admin/InterestsTab'
import { MembersTab } from './admin/MembersTab'
import { OverviewTab } from './admin/OverviewTab'
import { PaymentsTab } from './admin/PaymentsTab'
import { ReportsTab } from './admin/ReportsTab'

const TABS = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'members', label: '👥 Members' },
  { key: 'reports', label: '🚩 Reports' },
  { key: 'payments', label: '💳 Subscriptions & payments' },
  { key: 'interests', label: '🏷️ Interests' },
  { key: 'announcements', label: '📣 Announcements' },
]

/**
 * Admin control panel (module 4). Only ADMIN / MODERATOR accounts get in;
 * everyone else is bounced back to discover.
 */
export function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')

  if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
    return <Navigate to="/discover" replace />
  }

  return (
    <div className="container section">
      <div className="page-head">
        <div>
          <h1>Admin control panel</h1>
          <p className="card-desc">
            Members, moderation, reports, payments, the interest catalogue and announcements.
          </p>
        </div>
        <span className="badge badge-brand">{user.role}</span>
      </div>

      <div className="segmented admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={`segmented-item${tab === entry.key ? ' active' : ''}`}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewTab /> : null}
      {tab === 'members' ? <MembersTab /> : null}
      {tab === 'reports' ? <ReportsTab /> : null}
      {tab === 'payments' ? <PaymentsTab /> : null}
      {tab === 'interests' ? <InterestsTab /> : null}
      {tab === 'announcements' ? <AnnouncementsTab /> : null}
    </div>
  )
}

export default Admin

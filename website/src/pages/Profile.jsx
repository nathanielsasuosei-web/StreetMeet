import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHead } from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import { useCatalogue } from '../hooks/useCatalogue'
import { labelFor } from '../lib/format'

const MISSING_COPY = {
  gender: 'Add your gender',
  birthDate: 'Add your birth date',
  city: 'Add your city',
  bio: 'Write a bio (20+ characters)',
  photo: 'Add a profile photo',
  interests: 'Pick at least 3 interests',
  preferences: 'Set your dating preferences',
}

export function Profile() {
  const { user, refresh } = useAuth()
  const { catalogue } = useCatalogue()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refresh()
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [refresh])

  if (!user) {
    return (
      <div className="container page">
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} /> Loading your profile…
        </div>
      </div>
    )
  }

  const interestMeta = new Map((catalogue?.interests || []).map((item) => [item.slug, item]))
  const preferences = user.preferences || {}
  const settings = user.settings || {}

  const genderLabel =
    catalogue?.genders?.find((option) => option.value === user.gender)?.label || labelFor(user.gender)
  const goalLabel =
    catalogue?.relationshipGoals?.find((goal) => goal.value === preferences.relationshipGoal)?.label ||
    'Not set'

  return (
    <div className="container page">
      <div className="page-head row-between">
        <div>
          <h1>Your profile</h1>
          <p>This is what other members see - filtered by your privacy settings.</p>
        </div>
        <div className="row">
          <Button to="/profile/edit">Edit profile</Button>
          <Button variant="outline" to="/settings">
            Settings
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="alert alert-info">
          <span aria-hidden="true">↻</span> Refreshing your profile…
        </div>
      ) : null}

      {!user.profileComplete ? (
        <Card style={{ marginBottom: 20, borderColor: 'color-mix(in srgb, var(--warning) 40%, var(--line))' }}>
          <CardBody>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div>
                <h3>Finish your profile</h3>
                <p className="muted small">
                  Complete profiles get seen first. You are {user.completion ?? 0}% there.
                </p>
              </div>
              <span className="badge badge-warn">{user.missingFields?.length || 0} to go</span>
            </div>

            <div className="progress" style={{ marginBottom: 14 }}>
              <div className="progress-bar" style={{ width: `${user.completion ?? 0}%` }} />
            </div>

            <ul className="checklist" style={{ listStyle: 'none', padding: 0 }}>
              {(user.missingFields || []).map((field) => (
                <li key={field} className="check-item">
                  <span className="check-dot" aria-hidden="true">
                    •
                  </span>
                  {MISSING_COPY[field] || field}
                </li>
              ))}
            </ul>

            <div className="row" style={{ marginTop: 16 }}>
              <Button size="sm" to="/onboarding">
                Continue setup
              </Button>
              <Button size="sm" variant="ghost" to="/profile/edit">
                Edit details
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <span aria-hidden="true">✓</span> Your profile is complete and visible to other members.
        </div>
      )}

      <Card style={{ marginBottom: 20 }}>
        <CardBody>
          <div className="profile-hero">
            <Avatar src={user.profileImage} name={user.fullName} size="xl" verified={user.verified} />

            <div>
              <h1>
                {user.firstName}
                {user.age ? `, ${user.age}` : ''}
              </h1>
              <div className="profile-meta">
                {user.location ? <span>📍 {user.location}</span> : <span>📍 Location not set</span>}
                {user.gender ? <span>· {genderLabel}</span> : null}
                {user.verified ? (
                  <span className="badge badge-info" style={{ textTransform: 'none' }}>
                    ✓ Verified
                  </span>
                ) : null}
              </div>
              {user.bio ? <p style={{ marginTop: 14, maxWidth: '62ch' }}>{user.bio}</p> : null}
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <Button size="sm" variant="outline" to="/profile/edit">
                Edit
              </Button>
              <Link className="btn btn-ghost btn-sm" to="/settings">
                Privacy
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHead title="Interests" description="Shown on your profile and used to find common ground." />
          <CardBody>
            {user.interests?.length ? (
              <div className="chip-group">
                {user.interests.map((slug) => {
                  const meta = interestMeta.get(slug)
                  return (
                    <span key={slug} className="chip" style={{ cursor: 'default' }}>
                      {meta?.emoji ? (
                        <span className="chip-emoji" aria-hidden="true">
                          {meta.emoji}
                        </span>
                      ) : null}
                      {meta?.label || labelFor(slug)}
                    </span>
                  )
                })}
              </div>
            ) : (
              <div className="empty">
                <strong>No interests yet</strong>
                Pick a few so people know what you are into.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Dating preferences"
            description="Only you can see these."
            action={
              <Button size="sm" variant="ghost" to="/profile/edit">
                Change
              </Button>
            }
          />
          <CardBody>
            <dl className="detail-list">
              <div className="detail">
                <dt>Interested in</dt>
                <dd>
                  {preferences.interestedIn?.length
                    ? preferences.interestedIn.map(labelFor).join(', ')
                    : 'Not set'}
                </dd>
              </div>
              <div className="detail">
                <dt>Age range</dt>
                <dd>
                  {preferences.minAge ?? 18} – {preferences.maxAge ?? 45}
                </dd>
              </div>
              <div className="detail">
                <dt>Distance</dt>
                <dd>
                  {preferences.maxDistanceKm ? `Within ${preferences.maxDistanceKm} km` : 'Anywhere'}
                </dd>
              </div>
              <div className="detail">
                <dt>Looking for</dt>
                <dd>{goalLabel}</dd>
              </div>
              <div className="detail">
                <dt>Nearby first</dt>
                <dd>{preferences.openToNearby === false ? 'Off' : 'On'}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Profile details" description="The basics on your account." />
          <CardBody>
            <dl className="detail-list">
              <div className="detail">
                <dt>Full name</dt>
                <dd>{user.fullName}</dd>
              </div>
              <div className="detail">
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="detail">
                <dt>Phone</dt>
                <dd>{user.phoneNumber || '—'}</dd>
              </div>
              <div className="detail">
                <dt>Birth date</dt>
                <dd>{user.birthDate || '—'} (private)</dd>
              </div>
              <div className="detail">
                <dt>Member since</dt>
                <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Visibility"
            description="How your profile appears to other members."
            action={
              <Button size="sm" variant="ghost" to="/settings">
                Settings
              </Button>
            }
          />
          <CardBody>
            <dl className="detail-list">
              <div className="detail">
                <dt>Profile visibility</dt>
                <dd>{labelFor(settings.profileVisibility)}</dd>
              </div>
              <div className="detail">
                <dt>In discovery</dt>
                <dd>{settings.discoverable ? 'Yes' : 'Hidden'}</dd>
              </div>
              <div className="detail">
                <dt>Show age</dt>
                <dd>{settings.showAge ? 'Yes' : 'No'}</dd>
              </div>
              <div className="detail">
                <dt>Show location</dt>
                <dd>{settings.showLocation ? 'Yes' : 'No'}</dd>
              </div>
              <div className="detail">
                <dt>Messages from</dt>
                <dd>{labelFor(settings.allowMessagesFrom)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default Profile

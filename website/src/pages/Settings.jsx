import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PreferencesForm } from '../components/PreferencesForm'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card'
import { Field, PasswordInput, Select, TextInput } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Toggle } from '../components/ui/Toggle'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useCatalogue } from '../hooks/useCatalogue'
import { api } from '../lib/api'
import { cx, formatDateTime, passwordChecks } from '../lib/format'

const TABS = [
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'privacy', label: 'Privacy & visibility', icon: '🛡️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'preferences', label: 'Dating preferences', icon: '🎯' },
  { id: 'security', label: 'Security & closure', icon: '⚠️' },
]

const VISIBILITY_OPTIONS = [
  {
    value: 'PUBLIC',
    label: 'Public',
    hint: 'Anyone on StreetMeet can find your profile.',
  },
  {
    value: 'MATCHES_ONLY',
    label: 'Matches only',
    hint: 'Only people you match with see your full profile.',
  },
  {
    value: 'PRIVATE',
    label: 'Private',
    hint: 'Your profile is hidden. You stay invisible in discovery.',
  },
]

export function Settings() {
  const { user, endSession, rotateToken, refresh } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { genders, relationshipGoals } = useCatalogue()

  const [tab, setTab] = useState('account')
  const [settings, setSettings] = useState(null)
  const [account, setAccount] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [savingKey, setSavingKey] = useState(null)

  const [preferences, setPreferences] = useState(null)
  const [savingPreferences, setSavingPreferences] = useState(false)

  const [dialog, setDialog] = useState(null) // { type, ... }
  const [dialogForm, setDialogForm] = useState({})
  const [dialogErrors, setDialogErrors] = useState({})
  const [dialogBusy, setDialogBusy] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [overview, own] = await Promise.all([api.settings.get(), api.profile.preferences()])
        if (!active) return
        setSettings(overview.settings)
        setAccount(overview.account)
        setPreferences(own.preferences)
      } catch (error) {
        if (!active) return
        if (error?.status === 401 || error?.status === 403) {
          endSession()
          navigate('/login', { replace: true })
          return
        }
        setLoadError(error?.message || 'Could not load your settings.')
      }
    }

    load()
    return () => {
      active = false
    }
  }, [endSession, navigate])

  /** Optimistic toggle: apply, persist, roll back with a toast on failure. */
  const patchSetting = useCallback(
    async (key, value) => {
      const previous = settings
      setSettings((current) => ({ ...current, [key]: value }))
      setSavingKey(key)
      try {
        const { settings: saved } = await api.settings.update({ [key]: value })
        setSettings(saved)
      } catch (error) {
        setSettings(previous)
        toast.error(error?.message || 'Could not save that setting.')
      } finally {
        setSavingKey(null)
      }
    },
    [settings, toast],
  )

  function openDialog(type) {
    setDialog({ type })
    setDialogErrors({})
    setDialogForm(
      type === 'email'
        ? { email: account?.email || '', password: '' }
        : type === 'password'
          ? { currentPassword: '', newPassword: '', confirmPassword: '' }
          : type === 'delete'
            ? { password: '', confirmText: '' }
            : { password: '' },
    )
  }

  function closeDialog() {
    if (dialogBusy) return
    setDialog(null)
  }

  async function runDialog() {
    setDialogBusy(true)
    setDialogErrors({})

    try {
      if (dialog.type === 'email') {
        if (!dialogForm.email?.trim()) throw Object.assign(new Error('Enter the new email.'), { fields: { email: 'Enter the new email.' } })
        if (!dialogForm.password) throw Object.assign(new Error('Confirm your password.'), { fields: { password: 'Confirm your password.' } })

        await api.settings.changeEmail({
          email: dialogForm.email.trim(),
          password: dialogForm.password,
        })
        await refresh().catch(() => null)
        setAccount((current) => ({ ...current, email: dialogForm.email.trim() }))
        toast.success('Email updated.')
        setDialog(null)
      }

      if (dialog.type === 'password') {
        const failing = passwordChecks(dialogForm.newPassword || '').filter((check) => !check.ok)
        if (!dialogForm.currentPassword) {
          setDialogErrors({ currentPassword: 'Enter your current password.' })
          return
        }
        if (failing.length) {
          setDialogErrors({ newPassword: failing[0].label })
          return
        }
        if (dialogForm.newPassword !== dialogForm.confirmPassword) {
          setDialogErrors({ confirmPassword: 'Passwords do not match.' })
          return
        }

        const { token } = await api.settings.changePassword({
          currentPassword: dialogForm.currentPassword,
          newPassword: dialogForm.newPassword,
        })
        rotateToken(token)
        toast.success('Password changed. Other devices were signed out.')
        setDialog(null)
      }

      if (dialog.type === 'logoutAll') {
        await api.settings.logoutEverywhere()
        toast.info('All devices signed out. Log in again to continue.')
        navigate('/login', { replace: true })
        endSession()
        return
      }

      if (dialog.type === 'deactivate') {
        if (!dialogForm.password) {
          setDialogErrors({ password: 'Confirm your password.' })
          return
        }
        await api.settings.closeAccount({ password: dialogForm.password, mode: 'deactivate' })
        toast.info('Your account is deactivated. You can reactivate it from the log in page.')
        navigate('/', { replace: true })
        endSession()
        return
      }

      if (dialog.type === 'delete') {
        if (!dialogForm.password) {
          setDialogErrors({ password: 'Confirm your password.' })
          return
        }
        if (dialogForm.confirmText !== 'DELETE') {
          setDialogErrors({ confirmText: 'Type DELETE to confirm.' })
          return
        }
        await api.settings.closeAccount({
          password: dialogForm.password,
          mode: 'delete',
          confirmText: dialogForm.confirmText,
        })
        toast.info('Your account has been permanently deleted.')
        navigate('/', { replace: true })
        endSession()
      }
    } catch (error) {
      if (error?.fields && Object.keys(error.fields).length) setDialogErrors(error.fields)
      else toast.error(error?.message || 'That did not work.')
    } finally {
      setDialogBusy(false)
    }
  }

  async function savePreferences() {
    setSavingPreferences(true)
    try {
      const { preferences: saved } = await api.profile.updatePreferences(preferences)
      setPreferences(saved)
      await refresh().catch(() => null)
      toast.success('Preferences saved.')
    } catch (error) {
      toast.error(error?.fields?.[Object.keys(error.fields)[0]] || error?.message || 'Could not save.')
    } finally {
      setSavingPreferences(false)
    }
  }

  if (loadError) {
    return (
      <div className="container page container-narrow">
        <div className="alert alert-error">
          <span aria-hidden="true">⚠</span> {loadError}
        </div>
      </div>
    )
  }

  if (!settings || !account) {
    return (
      <div className="container page">
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} /> Loading your settings…
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Account settings</h1>
        <p>Privacy, notifications, security and how other people can reach you.</p>
      </div>

      <div className="settings-grid">
        <nav className="tabs" role="tablist" aria-label="Settings">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className="tab"
              onClick={() => setTab(item.id)}
            >
              <span className="tab-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="stack">
          {/* ── account ─────────────────────────────────────────────────── */}
          {tab === 'account' ? (
            <>
              <Card>
                <CardHead title="Login details" description="Used to sign in and to contact you about your account." />
                <CardBody>
                  <dl className="detail-list">
                    <div className="detail">
                      <dt>Email</dt>
                      <dd>
                        {account.email}{' '}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDialog('email')}>
                          Change
                        </button>
                      </dd>
                    </div>
                    <div className="detail">
                      <dt>Password</dt>
                      <dd>
                        ••••••••{' '}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDialog('password')}>
                          Change
                        </button>
                      </dd>
                    </div>
                    <div className="detail">
                      <dt>Phone</dt>
                      <dd>{account.phoneNumber || '—'}</dd>
                    </div>
                    <div className="detail">
                      <dt>Verification</dt>
                      <dd>
                        {account.verified ? (
                          <span className="badge badge-info">Verified</span>
                        ) : (
                          <span className="badge">Not verified</span>
                        )}
                      </dd>
                    </div>
                    <div className="detail">
                      <dt>Member since</dt>
                      <dd>{formatDateTime(account.createdAt)}</dd>
                    </div>
                    <div className="detail">
                      <dt>Last login</dt>
                      <dd>{formatDateTime(account.lastLoginAt)}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHead
                  title="Sessions"
                  description="StreetMeet uses signed tokens. Changing your password signs out every other device."
                />
                <CardBody>
                  <div className="toggle-row">
                    <div className="toggle-copy">
                      <strong>This device</strong>
                      <span>Signed in as {user?.email || account.email}</span>
                    </div>
                    <span className="badge badge-brand">Active</span>
                  </div>
                </CardBody>
                <CardFoot>
                  <Button variant="outline" onClick={() => openDialog('logoutAll')}>
                    Sign out of all devices
                  </Button>
                </CardFoot>
              </Card>
            </>
          ) : null}

          {/* ── privacy ─────────────────────────────────────────────────── */}
          {tab === 'privacy' ? (
            <>
              <Card>
                <CardHead title="Profile visibility" description="Who is allowed to see your profile at all." />
                <CardBody>
                  <div className="option-grid">
                    {VISIBILITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="option-card"
                        aria-pressed={settings.profileVisibility === option.value}
                        disabled={savingKey === 'profileVisibility'}
                        onClick={() => patchSetting('profileVisibility', option.value)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHead title="What other people see" description="Fine-grained switches for your profile card." />
                <CardBody>
                  <Toggle
                    checked={settings.showAge}
                    onChange={(value) => patchSetting('showAge', value)}
                    title="Show my age"
                    description="Turn this off and people only see your name and photo."
                  />
                  <Toggle
                    checked={settings.showLocation}
                    onChange={(value) => patchSetting('showLocation', value)}
                    title="Show my city and country"
                    description="Hides your location from every profile view."
                  />
                  <Toggle
                    checked={settings.showOnlineStatus}
                    onChange={(value) => patchSetting('showOnlineStatus', value)}
                    title="Show when I am online"
                    description="Used by chat once that module is rebuilt."
                  />
                  <Toggle
                    checked={settings.discoverable}
                    onChange={(value) => patchSetting('discoverable', value)}
                    title="Appear in discovery"
                    description="Turn off to pause new people finding you. Existing matches keep working."
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Who can message you" />
                <CardBody>
                  <Field label="Allow messages from" htmlFor="allowMessagesFrom">
                    <Select
                      id="allowMessagesFrom"
                      value={settings.allowMessagesFrom}
                      disabled={savingKey === 'allowMessagesFrom'}
                      options={[
                        { value: 'EVERYONE', label: 'Everyone on StreetMeet' },
                        { value: 'MATCHES', label: 'Only my matches' },
                        { value: 'NOBODY', label: 'Nobody (messages off)' },
                      ]}
                      onChange={(event) => patchSetting('allowMessagesFrom', event.target.value)}
                    />
                  </Field>
                </CardBody>
              </Card>
            </>
          ) : null}

          {/* ── notifications ───────────────────────────────────────────── */}
          {tab === 'notifications' ? (
            <Card>
              <CardHead
                title="Notifications"
                description="Changes save automatically. Delivery starts once the messaging module is live."
              />
              <CardBody>
                <Toggle
                  checked={settings.matchNotifications}
                  onChange={(value) => patchSetting('matchNotifications', value)}
                  title="New matches"
                  description="Tell me when someone likes me back."
                />
                <Toggle
                  checked={settings.messageNotifications}
                  onChange={(value) => patchSetting('messageNotifications', value)}
                  title="Messages"
                  description="Tell me when I get a new message."
                />
                <Toggle
                  checked={settings.pushNotifications}
                  onChange={(value) => patchSetting('pushNotifications', value)}
                  title="Push notifications"
                  description="Notifications on this device."
                />
                <Toggle
                  checked={settings.emailNotifications}
                  onChange={(value) => patchSetting('emailNotifications', value)}
                  title="Email notifications"
                  description={`Sent to ${account.email}.`}
                />
                <Toggle
                  checked={settings.productUpdates}
                  onChange={(value) => patchSetting('productUpdates', value)}
                  title="Product updates and tips"
                  description="Occasional news about StreetMeet. No third-party marketing."
                />
              </CardBody>
            </Card>
          ) : null}

          {/* ── preferences ─────────────────────────────────────────────── */}
          {tab === 'preferences' ? (
            <Card>
              <CardHead
                title="Dating preferences"
                description="The same controls as the sign-up wizard - change them any time."
              />
              <CardBody>
                {preferences ? (
                  <PreferencesForm
                    value={preferences}
                    onChange={setPreferences}
                    genders={genders}
                    goals={relationshipGoals}
                  />
                ) : (
                  <div className="page-loading">
                    <span className="spinner" />
                  </div>
                )}
              </CardBody>
              <CardFoot>
                <Button onClick={savePreferences} loading={savingPreferences} disabled={!preferences}>
                  Save preferences
                </Button>
              </CardFoot>
            </Card>
          ) : null}

          {/* ── security & closure ──────────────────────────────────────── */}
          {tab === 'security' ? (
            <>
              <Card>
                <CardHead title="Security" description="Keep your account safe." />
                <CardBody>
                  <div className="toggle-row">
                    <div className="toggle-copy">
                      <strong>Password</strong>
                      <span>Use 8+ characters with a letter and a number.</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openDialog('password')}>
                      Change
                    </Button>
                  </div>
                  <div className="toggle-row">
                    <div className="toggle-copy">
                      <strong>Two-factor authentication</strong>
                      <span>
                        {settings.twoFactorEnabled ? 'Enabled' : 'Not available yet'} - arrives with the
                        verification module.
                      </span>
                    </div>
                    <span className="badge">Soon</span>
                  </div>
                  <div className="toggle-row">
                    <div className="toggle-copy">
                      <strong>Sessions</strong>
                      <span>Sign out every device that has a token for this account.</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openDialog('logoutAll')}>
                      Sign out everywhere
                    </Button>
                  </div>
                </CardBody>
              </Card>

              <Card danger>
                <CardHead
                  title="Close your account"
                  description="Deactivating hides you immediately and can be undone. Deleting is permanent."
                />
                <CardBody>
                  <div className="toggle-row">
                    <div className="toggle-copy">
                      <strong>Deactivate</strong>
                      <span>
                        Your profile disappears from discovery. Sign in again to reactivate it - nothing
                        is lost.
                      </span>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => openDialog('deactivate')}>
                      Deactivate
                    </Button>
                  </div>
                  <div className="toggle-row">
                    <div className="toggle-copy">
                      <strong>Delete permanently</strong>
                      <span>Removes your profile, photos, preferences and settings for good.</span>
                    </div>
                    <Button size="sm" variant="danger-solid" onClick={() => openDialog('delete')}>
                      Delete account
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      {/* ── dialogs ─────────────────────────────────────────────────────── */}
      <Modal
        open={dialog?.type === 'email'}
        title="Change email address"
        description="You will need to confirm your password. Tokens for other devices stay valid."
        confirmLabel="Update email"
        busy={dialogBusy}
        onConfirm={runDialog}
        onClose={closeDialog}
      >
        <Field label="New email" htmlFor="new-email" error={dialogErrors.email}>
          <TextInput
            id="new-email"
            type="email"
            autoComplete="email"
            value={dialogForm.email || ''}
            error={dialogErrors.email}
            onChange={(event) => setDialogForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Field>
        <Field label="Current password" htmlFor="email-password" error={dialogErrors.password}>
          <PasswordInput
            id="email-password"
            autoComplete="current-password"
            value={dialogForm.password || ''}
            error={dialogErrors.password}
            onChange={(event) => setDialogForm((current) => ({ ...current, password: event.target.value }))}
          />
        </Field>
      </Modal>

      <Modal
        open={dialog?.type === 'password'}
        title="Change password"
        description="Every other device is signed out. This device gets a fresh token."
        confirmLabel="Change password"
        busy={dialogBusy}
        onConfirm={runDialog}
        onClose={closeDialog}
      >
        <Field label="Current password" htmlFor="current-password" error={dialogErrors.currentPassword}>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            value={dialogForm.currentPassword || ''}
            error={dialogErrors.currentPassword}
            onChange={(event) =>
              setDialogForm((current) => ({ ...current, currentPassword: event.target.value }))
            }
          />
        </Field>
        <Field label="New password" htmlFor="new-password" error={dialogErrors.newPassword}>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            value={dialogForm.newPassword || ''}
            error={dialogErrors.newPassword}
            onChange={(event) =>
              setDialogForm((current) => ({ ...current, newPassword: event.target.value }))
            }
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password" error={dialogErrors.confirmPassword}>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={dialogForm.confirmPassword || ''}
            error={dialogErrors.confirmPassword}
            onChange={(event) =>
              setDialogForm((current) => ({ ...current, confirmPassword: event.target.value }))
            }
          />
        </Field>
        <ul className="checklist" style={{ listStyle: 'none', padding: 0 }}>
          {passwordChecks(dialogForm.newPassword || '').map((check) => (
            <li key={check.id} className={cx('check-item')} data-done={check.ok}>
              <span className="check-dot" aria-hidden="true">
                {check.ok ? '✓' : '•'}
              </span>
              {check.label}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={dialog?.type === 'logoutAll'}
        title="Sign out of all devices?"
        description="Every session for this account is ended, including this one. You will need to log in again."
        confirmLabel="Sign out everywhere"
        variant="danger"
        busy={dialogBusy}
        onConfirm={runDialog}
        onClose={closeDialog}
      />

      <Modal
        open={dialog?.type === 'deactivate'}
        title="Deactivate your account?"
        description="Your profile is hidden from everyone straight away. Log in again at any time to reactivate it."
        confirmLabel="Deactivate"
        variant="danger"
        busy={dialogBusy}
        onConfirm={runDialog}
        onClose={closeDialog}
      >
        <Field label="Confirm your password" htmlFor="deactivate-password" error={dialogErrors.password}>
          <PasswordInput
            id="deactivate-password"
            autoComplete="current-password"
            value={dialogForm.password || ''}
            error={dialogErrors.password}
            onChange={(event) =>
              setDialogForm((current) => ({ ...current, password: event.target.value }))
            }
          />
        </Field>
      </Modal>

      <Modal
        open={dialog?.type === 'delete'}
        title="Delete your account permanently?"
        description="This removes your profile, photo, interests, preferences and settings. It cannot be undone."
        confirmLabel="Delete forever"
        variant="danger-solid"
        busy={dialogBusy}
        confirmDisabled={dialogForm.confirmText !== 'DELETE'}
        onConfirm={runDialog}
        onClose={closeDialog}
      >
        <Field label="Confirm your password" htmlFor="delete-password" error={dialogErrors.password}>
          <PasswordInput
            id="delete-password"
            autoComplete="current-password"
            value={dialogForm.password || ''}
            error={dialogErrors.password}
            onChange={(event) =>
              setDialogForm((current) => ({ ...current, password: event.target.value }))
            }
          />
        </Field>
        <Field label="Type DELETE to confirm" htmlFor="delete-confirm" error={dialogErrors.confirmText}>
          <TextInput
            id="delete-confirm"
            value={dialogForm.confirmText || ''}
            placeholder="DELETE"
            error={dialogErrors.confirmText}
            onChange={(event) =>
              setDialogForm((current) => ({ ...current, confirmText: event.target.value }))
            }
          />
        </Field>
      </Modal>
    </div>
  )
}

export default Settings

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PreferencesForm } from '../components/PreferencesForm'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card'
import { ChipGroup } from '../components/ui/Chip'
import { Field, Select, TextArea, TextInput } from '../components/ui/Field'
import { PhotoUploader } from '../components/ui/PhotoUploader'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useCatalogue } from '../hooks/useCatalogue'
import { api } from '../lib/api'
import { cx } from '../lib/format'

export function EditProfile() {
  const { user, refresh, setUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { catalogue, genders, interests, relationshipGoals, limits } = useCatalogue()

  const [form, setForm] = useState(null)
  const [preferences, setPreferences] = useState(null)
  const [errors, setErrors] = useState({})
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    if (!user) {
      refresh().catch(() => null)
      return
    }
    setForm((current) =>
      current ?? {
        fullName: user.fullName || '',
        gender: user.gender || '',
        birthDate: user.birthDate || '',
        city: user.city || '',
        country: user.country || '',
        bio: user.bio || '',
        phoneNumber: user.phoneNumber || '',
        interests: user.interests || [],
      },
    )
    setPreferences((current) =>
      current ?? {
        interestedIn: user.preferences?.interestedIn || ['MAN', 'WOMAN', 'NON_BINARY', 'OTHER'],
        minAge: user.preferences?.minAge ?? 18,
        maxAge: user.preferences?.maxAge ?? 45,
        maxDistanceKm: user.preferences?.maxDistanceKm ?? null,
        relationshipGoal: user.preferences?.relationshipGoal ?? null,
        openToNearby: user.preferences?.openToNearby !== false,
      },
    )
  }, [user, refresh])

  const dirtyDetails = useMemo(() => {
    if (!form || !user) return false
    return (
      form.fullName !== (user.fullName || '') ||
      form.gender !== (user.gender || '') ||
      form.birthDate !== (user.birthDate || '') ||
      form.city !== (user.city || '') ||
      form.country !== (user.country || '') ||
      form.bio !== (user.bio || '') ||
      form.phoneNumber !== (user.phoneNumber || '') ||
      form.interests.join(',') !== (user.interests || []).join(',')
    )
  }, [form, user])

  const dirtyPreferences = useMemo(() => {
    if (!preferences || !user?.preferences) return false
    const current = user.preferences
    return (
      preferences.interestedIn.join(',') !== (current.interestedIn || []).join(',') ||
      preferences.minAge !== current.minAge ||
      preferences.maxAge !== current.maxAge ||
      (preferences.maxDistanceKm ?? null) !== (current.maxDistanceKm ?? null) ||
      (preferences.relationshipGoal ?? null) !== (current.relationshipGoal ?? null) ||
      Boolean(preferences.openToNearby) !== Boolean(current.openToNearby)
    )
  }, [preferences, user])

  /* warn before leaving with unsaved edits */
  useEffect(() => {
    if (!dirtyDetails && !dirtyPreferences) return undefined
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyDetails, dirtyPreferences])

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current))
  }

  async function saveDetails(event) {
    event?.preventDefault()
    setSavingDetails(true)
    setErrors({})
    try {
      const { profile } = await api.profile.update({
        fullName: form.fullName.trim(),
        gender: form.gender || undefined,
        birthDate: form.birthDate || undefined,
        city: form.city.trim(),
        country: form.country.trim(),
        bio: form.bio.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
        interests: form.interests,
      })
      setUser(profile)
      await refresh().catch(() => profile)
      toast.success('Profile saved.')
    } catch (error) {
      const fields = error?.fields || {}
      setErrors(fields)
      toast.error(fields[Object.keys(fields)[0]] || error?.message || 'Could not save your profile.')
    } finally {
      setSavingDetails(false)
    }
  }

  async function savePreferences() {
    setSavingPreferences(true)
    setErrors({})
    try {
      await api.profile.updatePreferences(preferences)
      await refresh()
      toast.success('Preferences saved.')
    } catch (error) {
      const fields = error?.fields || {}
      setErrors(fields)
      toast.error(fields[Object.keys(fields)[0]] || error?.message || 'Could not save your preferences.')
    } finally {
      setSavingPreferences(false)
    }
  }

  async function handlePhoto(file) {
    setPhotoBusy(true)
    try {
      const { profile } = await api.profile.uploadPhoto(file)
      setUser(profile)
      toast.success('Photo updated.')
    } catch (error) {
      setErrors({ photo: error?.message || 'That upload did not work.' })
      toast.error(error?.message || 'That upload did not work.')
      throw error
    } finally {
      setPhotoBusy(false)
    }
  }

  async function removePhoto() {
    setPhotoBusy(true)
    try {
      const { profile } = await api.profile.removePhoto()
      setUser(profile)
      toast.info('Photo removed.')
    } catch (error) {
      toast.error(error?.message || 'Could not remove the photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function cancel() {
    if (dirtyDetails || dirtyPreferences) {
      const sure = window.confirm('Discard your unsaved changes?')
      if (!sure) return
    }
    navigate('/profile')
  }

  if (!form || !preferences) {
    return (
      <div className="container page">
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} /> Loading your details…
        </div>
      </div>
    )
  }

  const interestCount = form.interests.length

  return (
    <div className="container page container-narrow" style={{ maxWidth: 900 }}>
      <div className="page-head row-between">
        <div>
          <h1>Edit profile</h1>
          <p>Update your details, photo and who you want to meet.</p>
        </div>
        <Button variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>

      <div className="stack">
        <Card>
          <CardHead
            title="Profile photo"
            description="Square images work best. We resize it to 1000px and strip any location data."
          />
          <CardBody>
            <PhotoUploader
              value={user?.profileImage}
              name={form.fullName}
              busy={photoBusy}
              error={errors.photo}
              onUpload={handlePhoto}
              onRemove={user?.profileImage ? removePhoto : null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Your details" description="Only your age is public - never your birth date." />
          <CardBody>
            <form className="stack" style={{ gap: 18 }} onSubmit={saveDetails} noValidate>
              <div className="grid-2">
                <Field label="Full name" htmlFor="edit-fullName" error={errors.fullName} required>
                  <TextInput
                    id="edit-fullName"
                    value={form.fullName}
                    autoComplete="name"
                    error={errors.fullName}
                    onChange={(event) => setField('fullName', event.target.value)}
                  />
                </Field>

                <Field label="Gender" htmlFor="edit-gender" error={errors.gender}>
                  <Select
                    id="edit-gender"
                    value={form.gender}
                    placeholder="Prefer not to say"
                    options={genders}
                    error={errors.gender}
                    onChange={(event) => setField('gender', event.target.value)}
                  />
                </Field>

                <Field
                  label="Birth date"
                  htmlFor="edit-birthDate"
                  error={errors.birthDate}
                  hint="Used to calculate your age. Must be 18+."
                >
                  <TextInput
                    id="edit-birthDate"
                    type="date"
                    value={form.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    error={errors.birthDate}
                    onChange={(event) => setField('birthDate', event.target.value)}
                  />
                </Field>

                <Field label="Phone number" htmlFor="edit-phone" error={errors.phoneNumber} optional>
                  <TextInput
                    id="edit-phone"
                    type="tel"
                    value={form.phoneNumber}
                    placeholder="+233 20 000 0000"
                    autoComplete="tel"
                    error={errors.phoneNumber}
                    onChange={(event) => setField('phoneNumber', event.target.value)}
                  />
                </Field>

                <Field label="City" htmlFor="edit-city" error={errors.city}>
                  <TextInput
                    id="edit-city"
                    value={form.city}
                    placeholder="Accra"
                    error={errors.city}
                    onChange={(event) => setField('city', event.target.value)}
                  />
                </Field>

                <Field label="Country" htmlFor="edit-country" error={errors.country} optional>
                  <Select
                    id="edit-country"
                    value={form.country}
                    placeholder="Select a country"
                    options={(catalogue?.countries || []).map((country) => ({
                      value: country,
                      label: country,
                    }))}
                    error={errors.country}
                    onChange={(event) => setField('country', event.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Bio"
                htmlFor="edit-bio"
                error={errors.bio}
                counter={
                  <span className="counter" data-over={form.bio.length > limits.bioMaxLength}>
                    {form.bio.length}/{limits.bioMaxLength}
                  </span>
                }
              >
                <TextArea
                  id="edit-bio"
                  rows={5}
                  value={form.bio}
                  error={errors.bio}
                  placeholder="What should people know about you?"
                  onChange={(event) => setField('bio', event.target.value)}
                />
              </Field>

              <div className="stack" style={{ gap: 10 }}>
                <div className="row-between">
                  <span className="label">Interests</span>
                  <span
                    className={cx(
                      'badge',
                      interestCount >= limits.interestsMin ? 'badge-brand' : 'badge-warn',
                    )}
                  >
                    {interestCount}/{limits.interestsMax} · min {limits.interestsMin}
                  </span>
                </div>

                {(catalogue?.interestCategories || []).map((category) => {
                  const inCategory = interests.filter((interest) => interest.category === category)
                  if (!inCategory.length) return null
                  return (
                    <div key={category} className="stack" style={{ gap: 8 }}>
                      <h4
                        className="muted tiny"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                      >
                        {category}
                      </h4>
                      <ChipGroup
                        options={inCategory}
                        value={form.interests}
                        max={limits.interestsMax}
                        onChange={(next) => setField('interests', next)}
                      />
                    </div>
                  )
                })}

                {errors.interests ? <p className="error-text">{errors.interests}</p> : null}
              </div>
            </form>
          </CardBody>
          <CardFoot>
            <span className="muted small" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {dirtyDetails ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={saveDetails} loading={savingDetails} disabled={!dirtyDetails}>
              Save details
            </Button>
          </CardFoot>
        </Card>

        <Card>
          <CardHead
            title="Dating preferences"
            description="Who you want to meet. Private to you - never shown on your profile."
          />
          <CardBody>
            <PreferencesForm
              value={preferences}
              onChange={setPreferences}
              genders={genders}
              goals={relationshipGoals}
              errors={errors}
            />
          </CardBody>
          <CardFoot>
            <span className="muted small" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {dirtyPreferences ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button onClick={savePreferences} loading={savingPreferences} disabled={!dirtyPreferences}>
              Save preferences
            </Button>
          </CardFoot>
        </Card>
      </div>
    </div>
  )
}

export default EditProfile

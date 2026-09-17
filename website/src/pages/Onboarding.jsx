import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PreferencesForm } from '../components/PreferencesForm'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { ChipGroup } from '../components/ui/Chip'
import { Field, Select, TextArea, TextInput } from '../components/ui/Field'
import { PhotoUploader } from '../components/ui/PhotoUploader'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useCatalogue } from '../hooks/useCatalogue'
import { api } from '../lib/api'
import { ageFrom, cx } from '../lib/format'

const DRAFT_KEY = 'streetmeet.onboarding.draft'

const EMPTY_DRAFT = {
  gender: '',
  birthDate: '',
  city: '',
  country: '',
  bio: '',
  interests: [],
  preferences: {
    interestedIn: ['MAN', 'WOMAN', 'NON_BINARY', 'OTHER'],
    minAge: 18,
    maxAge: 45,
    maxDistanceKm: 25,
    relationshipGoal: null,
    openToNearby: true,
  },
}

/** Which server-side field errors belong to which wizard step. */
const STEP_FIELDS = [
  ['gender', 'birthDate'],
  ['city', 'country'],
  ['interests'],
  ['bio'],
  ['interestedIn', 'minAge', 'maxAge', 'maxDistanceKm', 'relationshipGoal'],
  ['photo'],
]

function loadDraft(user) {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (stored) {
      return {
        ...EMPTY_DRAFT,
        ...stored,
        preferences: { ...EMPTY_DRAFT.preferences, ...(stored.preferences || {}) },
      }
    }
  } catch {
    /* a corrupt draft is not worth blocking sign-up over */
  }

  // Coming back to finish an existing account? Pre-fill from the profile.
  if (user) {
    return {
      ...EMPTY_DRAFT,
      gender: user.gender || '',
      birthDate: user.birthDate || '',
      city: user.city || '',
      country: user.country || '',
      bio: user.bio || '',
      interests: user.interests || [],
      preferences: user.preferences
        ? { ...EMPTY_DRAFT.preferences, ...user.preferences }
        : EMPTY_DRAFT.preferences,
    }
  }

  return EMPTY_DRAFT
}

export function Onboarding() {
  const { user, refresh, setUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { catalogue, genders, interests, relationshipGoals, limits, isLoading } = useCatalogue()

  const [draft, setDraft] = useState(() => loadDraft(user))
  const [step, setStep] = useState(0)
  const [highestStep, setHighestStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [photoBusy, setPhotoBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /* keep the draft if the member reloads mid-way */
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* storage blocked - the wizard still works in memory */
    }
  }, [draft])

  /* late-arriving session data fills any field the member has not touched */
  useEffect(() => {
    if (!user) return
    setDraft((current) => ({
      ...current,
      gender: current.gender || user.gender || '',
      birthDate: current.birthDate || user.birthDate || '',
      city: current.city || user.city || '',
      country: current.country || user.country || '',
      bio: current.bio || user.bio || '',
      interests: current.interests.length ? current.interests : user.interests || [],
    }))
  }, [user])

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const setPreferences = (preferences) => setDraft((current) => ({ ...current, preferences }))

  const age = ageFrom(draft.birthDate)
  const interestCount = draft.interests.length

  const steps = useMemo(
    () => [
      { id: 'identity', label: 'About you' },
      { id: 'location', label: 'Location' },
      { id: 'interests', label: 'Interests' },
      { id: 'bio', label: 'Bio' },
      { id: 'preferences', label: 'Preferences' },
      { id: 'photo', label: 'Photo' },
    ],
    [],
  )

  const copy = [
    {
      title: 'Who are you?',
      blurb: 'This is how you will appear to other members.',
    },
    {
      title: 'Where are you based?',
      blurb: 'We use your city to show you people nearby.',
    },
    {
      title: 'What are you into?',
      blurb: `Pick at least ${limits.interestsMin} - shared interests are the easiest way to start a conversation.`,
    },
    {
      title: 'Say something about yourself',
      blurb: 'Two or three honest sentences beat a blank profile every time.',
    },
    {
      title: 'Who do you want to meet?',
      blurb: 'You can change all of this later from your profile or settings.',
    },
    {
      title: 'Add your photo',
      blurb: 'Profiles with a photo get many times more messages. You can skip this and add one later.',
    },
  ]

  function validateStep(index) {
    const next = {}

    if (index === 0) {
      if (!draft.gender) next.gender = 'Select the option that fits you.'
      if (!draft.birthDate) next.birthDate = 'Enter your birth date.'
      else if (!age) next.birthDate = 'That date does not look right.'
      else if (age < limits.minAge)
        next.birthDate = `You must be ${limits.minAge} or older to use StreetMeet.`
    }

    if (index === 1 && !draft.city.trim()) next.city = 'Enter your city.'

    if (index === 2 && interestCount < limits.interestsMin)
      next.interests = `Pick at least ${limits.interestsMin} interests (${interestCount} selected).`

    if (index === 3) {
      if (draft.bio.trim().length < 20)
        next.bio = 'Write at least 20 characters - it helps people start a conversation.'
      else if (draft.bio.length > limits.bioMaxLength)
        next.bio = `Keep it under ${limits.bioMaxLength} characters.`
    }

    if (index === 4) {
      if (!draft.preferences.interestedIn.length) next.interestedIn = 'Select at least one option.'
      if (draft.preferences.minAge > draft.preferences.maxAge)
        next.minAge = 'The minimum age cannot be higher than the maximum.'
    }

    return next
  }

  function goTo(index) {
    setErrors({})
    setStep(index)
    setHighestStep((current) => Math.max(current, index))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function next() {
    const problems = validateStep(step)
    if (Object.keys(problems).length) {
      setErrors(problems)
      return
    }
    if (step < steps.length - 1) goTo(step + 1)
  }

  async function uploadPhoto(file) {
    setPhotoBusy(true)
    try {
      const { profile } = await api.profile.uploadPhoto(file)
      setUser(profile)
      toast.success('Photo uploaded.')
    } catch (error) {
      setErrors({ photo: error?.message || 'That upload did not work.' })
      toast.error(error?.message || 'That upload did not work.')
      throw error
    } finally {
      setPhotoBusy(false)
    }
  }

  async function finish() {
    setSubmitting(true)
    try {
      await api.profile.onboard({
        gender: draft.gender,
        birthDate: draft.birthDate,
        city: draft.city.trim(),
        country: draft.country.trim() || undefined,
        bio: draft.bio.trim(),
        interests: draft.interests,
        preferences: draft.preferences,
      })

      await refresh()

      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* not important */
      }

      toast.success('Your profile is live. Time to meet someone.')
      navigate('/profile', { replace: true })
    } catch (error) {
      const fields = error?.fields || {}
      setErrors(fields)

      const brokenStep = STEP_FIELDS.findIndex((fieldList) =>
        Object.keys(fields).some((field) => fieldList.includes(field)),
      )
      if (brokenStep >= 0) goTo(brokenStep)

      toast.error(fields[Object.keys(fields)[0]] || error?.message || 'We could not save your profile.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading && !catalogue) {
    return (
      <div className="container page">
        <div className="page-loading">
          <span className="spinner" style={{ width: 22, height: 22 }} /> Loading your profile setup…
        </div>
      </div>
    )
  }

  const percent = Math.round(((step + 1) / steps.length) * 100)

  return (
    <div className="container page">
      <div className="page-head">
        <span className="badge badge-brand">
          Step {step + 1} of {steps.length}
        </span>
        <h1 style={{ marginTop: 12 }}>Create your profile</h1>
        <p>Six quick steps. Everything here can be changed later from your profile or settings.</p>
        <div className="progress" style={{ marginTop: 16, maxWidth: 420 }}>
          <div className="progress-bar" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="wizard">
        <nav className="wizard-nav" aria-label="Profile setup steps">
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="wizard-step"
              aria-current={index === step ? 'step' : undefined}
              data-done={index < highestStep}
              onClick={() => index <= highestStep && goTo(index)}
              disabled={index > highestStep}
            >
              <span className="wizard-index" aria-hidden="true">
                {index < highestStep ? '✓' : index + 1}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <Card>
          <CardBody className="wizard-panel">
            <h2>{copy[step].title}</h2>
            <p>{copy[step].blurb}</p>

            {/* ── identity ─────────────────────────────────────────────── */}
            {step === 0 ? (
              <div className="stack" style={{ gap: 26 }}>
                <div className="stack" style={{ gap: 10 }}>
                  <span className="label">Gender</span>
                  <div className="option-grid">
                    {genders.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="option-card"
                        aria-pressed={draft.gender === option.value}
                        onClick={() => set({ gender: option.value })}
                      >
                        <strong>{option.label}</strong>
                      </button>
                    ))}
                  </div>
                  {errors.gender ? <p className="error-text">{errors.gender}</p> : null}
                </div>

                <Field
                  label="Birth date"
                  htmlFor="birthDate"
                  error={errors.birthDate}
                  hint={
                    age
                      ? `You are ${age}. Other members only ever see your age, never the date.`
                      : 'Other members see your age, not the exact date.'
                  }
                  required
                >
                  <TextInput
                    id="birthDate"
                    type="date"
                    value={draft.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    error={errors.birthDate}
                    onChange={(event) => set({ birthDate: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {/* ── location ─────────────────────────────────────────────── */}
            {step === 1 ? (
              <div className="stack" style={{ gap: 18 }}>
                <div className="grid-2">
                  <Field label="City" htmlFor="city" error={errors.city} required>
                    <TextInput
                      id="city"
                      value={draft.city}
                      placeholder="Accra"
                      autoComplete="address-level2"
                      error={errors.city}
                      onChange={(event) => set({ city: event.target.value })}
                    />
                  </Field>

                  <Field label="Country" htmlFor="country" optional>
                    <Select
                      id="country"
                      value={draft.country}
                      placeholder="Select a country"
                      options={(catalogue?.countries || []).map((country) => ({
                        value: country,
                        label: country,
                      }))}
                      onChange={(event) => set({ country: event.target.value })}
                    />
                  </Field>
                </div>

                <div className="alert alert-info">
                  <span aria-hidden="true">📍</span>
                  <span>
                    Your city helps us show people nearby. You can hide it from your profile at any
                    time under <strong className="strong">Settings → Privacy</strong>.
                  </span>
                </div>
              </div>
            ) : null}

            {/* ── interests ────────────────────────────────────────────── */}
            {step === 2 ? (
              <div className="stack" style={{ gap: 20 }}>
                <div className="row-between">
                  <span className="label">
                    {interestCount} of {limits.interestsMax} selected
                  </span>
                  <span
                    className={cx(
                      'badge',
                      interestCount >= limits.interestsMin ? 'badge-brand' : 'badge-warn',
                    )}
                  >
                    minimum {limits.interestsMin}
                  </span>
                </div>

                {(catalogue?.interestCategories || []).map((category) => {
                  const inCategory = interests.filter((interest) => interest.category === category)
                  if (!inCategory.length) return null
                  return (
                    <div key={category} className="stack" style={{ gap: 10 }}>
                      <h4
                        className="muted tiny"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                      >
                        {category}
                      </h4>
                      <ChipGroup
                        options={inCategory}
                        value={draft.interests}
                        max={limits.interestsMax}
                        onChange={(nextInterests) => set({ interests: nextInterests })}
                      />
                    </div>
                  )
                })}

                {errors.interests ? <p className="error-text">{errors.interests}</p> : null}
              </div>
            ) : null}

            {/* ── bio ──────────────────────────────────────────────────── */}
            {step === 3 ? (
              <div className="stack" style={{ gap: 16 }}>
                <Field
                  label="Bio"
                  htmlFor="bio"
                  error={errors.bio}
                  counter={
                    <span className="counter" data-over={draft.bio.length > limits.bioMaxLength}>
                      {draft.bio.length}/{limits.bioMaxLength}
                    </span>
                  }
                  required
                >
                  <TextArea
                    id="bio"
                    rows={6}
                    value={draft.bio}
                    error={errors.bio}
                    placeholder="What do you do, what are you into, and what does a perfect Saturday look like?"
                    onChange={(event) => set({ bio: event.target.value })}
                  />
                </Field>

                <Card style={{ background: 'var(--surface-2)' }}>
                  <CardBody>
                    <p className="small strong" style={{ marginBottom: 8 }}>
                      Need a start?
                    </p>
                    <ul className="checklist" style={{ listStyle: 'none', padding: 0 }}>
                      {[
                        'What you do - and what you actually enjoy about it',
                        'Something you are unreasonably good at',
                        'What you are looking for next',
                      ].map((tip) => (
                        <li key={tip} className="check-item" data-done>
                          <span className="check-dot" aria-hidden="true">
                            ✓
                          </span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {/* ── preferences ──────────────────────────────────────────── */}
            {step === 4 ? (
              <PreferencesForm
                value={draft.preferences}
                onChange={setPreferences}
                genders={genders}
                goals={relationshipGoals}
                errors={errors}
              />
            ) : null}

            {/* ── photo ────────────────────────────────────────────────── */}
            {step === 5 ? (
              <div className="stack" style={{ gap: 20 }}>
                <PhotoUploader
                  value={user?.profileImage}
                  name={user?.fullName}
                  busy={photoBusy}
                  error={errors.photo}
                  onUpload={uploadPhoto}
                  onRemove={
                    user?.profileImage
                      ? async () => {
                          const { profile } = await api.profile.removePhoto()
                          setUser(profile)
                          toast.info('Photo removed.')
                        }
                      : null
                  }
                  hint="JPG, PNG or WebP · up to 5 MB. We resize it and strip any location data."
                />

                <Card style={{ background: 'var(--surface-2)' }}>
                  <CardBody>
                    <p className="small strong" style={{ marginBottom: 8 }}>
                      Photo tips
                    </p>
                    <ul className="checklist" style={{ listStyle: 'none', padding: 0 }}>
                      {[
                        'Your face clearly visible, in good light',
                        'Avoid sunglasses in your only photo',
                        'Save the group shot for your second photo',
                      ].map((tip) => (
                        <li key={tip} className="check-item" data-done>
                          <span className="check-dot" aria-hidden="true">
                            ✓
                          </span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            <div className="wizard-actions">
              <Button
                variant="ghost"
                onClick={() => goTo(Math.max(0, step - 1))}
                disabled={step === 0 || submitting}
              >
                ← Back
              </Button>

              {step < steps.length - 1 ? (
                <Button onClick={next}>Continue →</Button>
              ) : (
                <div className="row">
                  <Button variant="outline" onClick={finish} disabled={submitting}>
                    Skip photo
                  </Button>
                  <Button onClick={finish} loading={submitting}>
                    Finish profile
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default Onboarding

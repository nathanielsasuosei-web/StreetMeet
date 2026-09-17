import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Field, PasswordInput, TextInput } from '../components/ui/Field'
import { PasswordStrength } from '../components/ui/PasswordStrength'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useForm } from '../hooks/useForm'
import { passwordChecks } from '../lib/format'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

const INITIAL = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
}

function validate(values) {
  const errors = {}

  const name = values.fullName.trim()
  if (name.length < 2) errors.fullName = 'Enter your full name (2 characters or more).'
  else if (name.length > 120) errors.fullName = 'That name is too long.'
  else if (!/^[\p{L}][\p{L}\s'’.-]*$/u.test(name))
    errors.fullName = 'Letters, spaces, hyphens and apostrophes only.'

  if (!values.email.trim()) errors.email = 'Enter your email address.'
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'That email does not look right.'

  const failing = passwordChecks(values.password).filter((check) => !check.ok)
  if (!values.password) errors.password = 'Choose a password.'
  else if (failing.length) errors.password = failing[0].label + '.'

  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.'
  if (!values.acceptTerms) errors.acceptTerms = 'You must accept the terms to continue.'

  return errors
}

export function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showStrength, setShowStrength] = useState(false)

  const form = useForm({
    initial: INITIAL,
    validate,
    onSubmit: async (values) => {
      await register({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
      })
      toast.success('Account created - let’s build your profile.')
      navigate('/onboarding', { replace: true })
    },
  })

  return (
    <div className="container auth-wrap">
      <aside className="auth-aside">
        <span className="badge badge-brand">Create your account</span>
        <h1 style={{ marginTop: 14 }}>Real people, right around the corner.</h1>
        <p>
          StreetMeet is for meeting people you would actually get on with - based on what you are
          into, where you are, and what you are looking for.
        </p>

        <div className="auth-points">
          {[
            { icon: '🪪', text: 'A profile with your age, city, bio and interests' },
            { icon: '🎯', text: 'Dating preferences you control: who, what age, how far' },
            { icon: '🔒', text: 'Private by default - you choose what other people see' },
          ].map((point) => (
            <div className="auth-point" key={point.text}>
              <span className="auth-point-icon" aria-hidden="true">
                {point.icon}
              </span>
              <span>{point.text}</span>
            </div>
          ))}
        </div>
      </aside>

      <Card className="auth-card">
        <CardBody>
          <h2>Sign up</h2>
          <p className="muted small">Takes about a minute. You can finish your profile after.</p>

          <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
            {form.formError ? (
              <div className="alert alert-error" role="alert">
                <span aria-hidden="true">⚠</span>
                <span>{form.formError}</span>
              </div>
            ) : null}

            <Field label="Full name" htmlFor="fullName" error={form.errors.fullName} required>
              <TextInput
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Ama Serwaa"
                value={form.values.fullName}
                error={form.errors.fullName}
                onChange={(event) => form.setField('fullName', event.target.value)}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={form.errors.email} required>
              <TextInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={form.values.email}
                error={form.errors.email}
                onChange={(event) => form.setField('email', event.target.value)}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              error={form.errors.password}
              hint="At least 8 characters, with a letter and a number."
              required
            >
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.values.password}
                error={form.errors.password}
                onFocus={() => setShowStrength(true)}
                onChange={(event) => {
                  setShowStrength(true)
                  form.setField('password', event.target.value)
                }}
              />
            </Field>

            {showStrength ? <PasswordStrength password={form.values.password} /> : null}

            <Field label="Confirm password" htmlFor="confirmPassword" error={form.errors.confirmPassword} required>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.values.confirmPassword}
                error={form.errors.confirmPassword}
                onChange={(event) => form.setField('confirmPassword', event.target.value)}
              />
            </Field>

            <div>
              <label className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={form.values.acceptTerms}
                  style={{ marginTop: 4 }}
                  onChange={(event) => form.setField('acceptTerms', event.target.checked)}
                />
                <span className="small">
                  I am 18 or older and I accept the{' '}
                  <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
                </span>
              </label>
              {form.errors.acceptTerms ? (
                <p className="error-text">
                  <span aria-hidden="true">⚠</span> {form.errors.acceptTerms}
                </p>
              ) : null}
            </div>

            <Button type="submit" size="lg" block loading={form.submitting}>
              Create account
            </Button>

            <p className="auth-switch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

export default Register

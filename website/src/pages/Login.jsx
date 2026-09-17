import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Field, PasswordInput, TextInput } from '../components/ui/Field'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useForm } from '../hooks/useForm'

const DEMO_ACCOUNT = { email: 'ama@streetmeet.dev', password: 'Street1234' }

export function Login() {
  const { login, reactivate } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login') // login | reactivate

  const redirectTo = location.state?.from || null

  function afterAuth(user) {
    if (redirectTo) return navigate(redirectTo, { replace: true })
    return navigate(user?.profileComplete ? '/profile' : '/onboarding', { replace: true })
  }

  const form = useForm({
    initial: { email: '', password: '' },
    validate: (values) => {
      const errors = {}
      if (!values.email.trim()) errors.email = 'Enter your email address.'
      if (!values.password) errors.password = 'Enter your password.'
      return errors
    },
    onSubmit: async (values) => {
      const payload = { email: values.email.trim(), password: values.password }
      const user =
        mode === 'reactivate' ? await reactivate(payload) : await login(payload)

      toast.success(mode === 'reactivate' ? 'Your account is back.' : 'Welcome back!')
      afterAuth(user)
    },
  })

  return (
    <div className="container auth-wrap">
      <aside className="auth-aside">
        <span className="badge badge-brand">Welcome back</span>
        <h1 style={{ marginTop: 14 }}>Pick up where you left off.</h1>
        <p>
          Your profile, preferences and privacy settings are exactly where you left them - sign in
          to keep meeting people.
        </p>

        <div className="auth-points">
          {[
            { icon: '📸', text: 'Update your photo whenever you like' },
            { icon: '🧭', text: 'Change who you meet: gender, age range, distance' },
            { icon: '🛡️', text: 'One place for privacy, notifications and security' },
          ].map((point) => (
            <div className="auth-point" key={point.text}>
              <span className="auth-point-icon" aria-hidden="true">
                {point.icon}
              </span>
              <span>{point.text}</span>
            </div>
          ))}
        </div>

        <Card style={{ marginTop: 26 }}>
          <CardBody>
            <p className="tiny muted" style={{ marginBottom: 8 }}>
              <strong className="strong">Demo account</strong> (created by <code>npm run db:seed</code>)
            </p>
            <p className="tiny">
              {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
            </p>
            <Button
              size="sm"
              variant="outline"
              style={{ marginTop: 10 }}
              onClick={() => {
                form.setMany(DEMO_ACCOUNT)
                setMode('login')
              }}
            >
              Fill in
            </Button>
          </CardBody>
        </Card>
      </aside>

      <Card className="auth-card">
        <CardBody>
          <h2>{mode === 'reactivate' ? 'Reactivate your account' : 'Log in'}</h2>
          <p className="muted small">
            {mode === 'reactivate'
              ? 'Confirm your email and password to bring your profile back.'
              : 'Enter the email and password you signed up with.'}
          </p>

          <form className="auth-form" onSubmit={form.handleSubmit} noValidate>
            {form.formError ? (
              <div className="alert alert-error" role="alert">
                <span aria-hidden="true">⚠</span>
                <span>{form.formError}</span>
              </div>
            ) : null}

            <Field label="Email" htmlFor="login-email" error={form.errors.email} required>
              <TextInput
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.values.email}
                error={form.errors.email}
                onChange={(event) => form.setField('email', event.target.value)}
              />
            </Field>

            <Field label="Password" htmlFor="login-password" error={form.errors.password} required>
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.values.password}
                error={form.errors.password}
                onChange={(event) => form.setField('password', event.target.value)}
              />
            </Field>

            <Button type="submit" size="lg" block loading={form.submitting}>
              {mode === 'reactivate' ? 'Reactivate account' : 'Log in'}
            </Button>

            <p className="auth-switch">
              New here? <Link to="/register">Create an account</Link>
            </p>

            <hr className="divider" />

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setMode(mode === 'reactivate' ? 'login' : 'reactivate')
                  form.setFormError(null)
                  form.setErrors({})
                }}
              >
                {mode === 'reactivate' ? '← Back to log in' : 'Account deactivated?'}
              </button>
              <span className="tiny muted">
                Password reset by email is not part of this rebuild.
              </span>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

export default Login

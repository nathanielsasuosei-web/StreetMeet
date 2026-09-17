import { passwordChecks, passwordScore } from '../../lib/format'

const LABELS = ['Too short', 'Weak', 'Getting there', 'Good', 'Strong', 'Excellent']

export function PasswordStrength({ password = '' }) {
  const checks = passwordChecks(password)
  const score = passwordScore(password)
  const max = checks.length + 1
  const percent = Math.round((score / max) * 100)
  const label = LABELS[Math.min(score, LABELS.length - 1)]

  if (!password) return null

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="progress" aria-hidden="true">
        <div className="progress-bar" style={{ width: `${percent}%` }} />
      </div>
      <p className="hint">
        Password strength: <strong className="strong">{label}</strong>
      </p>
      <ul className="checklist" style={{ listStyle: 'none', padding: 0 }}>
        {checks.map((check) => (
          <li key={check.id} className="check-item" data-done={check.ok}>
            <span className="check-dot" aria-hidden="true">
              {check.ok ? '✓' : '•'}
            </span>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PasswordStrength

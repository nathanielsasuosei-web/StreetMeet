import { Button } from './ui/Button'
import { Card, CardBody } from './ui/Card'

/**
 * Placeholder for the modules that have not been rebuilt yet (matching, chat,
 * status, premium). Honest and navigable instead of a blank crash.
 */
export function ComingSoon({ title, description, milestone, children }) {
  return (
    <div className="container page container-narrow">
      <div className="page-head">
        <span className="badge badge-warn">Module not rebuilt yet</span>
        <h1 style={{ marginTop: 12 }}>{title}</h1>
        <p>{description}</p>
      </div>

      <Card>
        <CardBody>
          <div className="stack">
            <p className="muted">
              This rebuild covers <strong className="strong">module 1 - user accounts</strong>:
              sign up and login, profile creation, profile photo, age / location / bio / interests,
              gender and dating preferences, edit profile and account settings.
            </p>
            {milestone ? (
              <p className="muted">
                Next up: <strong className="strong">{milestone}</strong>.
              </p>
            ) : null}
            {children}
            <div className="row">
              <Button to="/profile">Go to my profile</Button>
              <Button variant="outline" to="/settings">
                Account settings
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default ComingSoon

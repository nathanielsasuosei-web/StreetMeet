import { Card, CardBody, CardHead } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const COLLECTED = [
  { item: 'Name, email and password', why: 'To create and secure your account. Passwords are hashed with bcrypt - never stored as text.' },
  { item: 'Birth date', why: 'To prove you are 18+ and to show other members your age. The exact date is never displayed.' },
  { item: 'Gender and who you want to meet', why: 'To filter the people we show you. Preferences are private to you.' },
  { item: 'City and country', why: 'To show you people nearby. You can hide your location at any time.' },
  { item: 'Photo, bio and interests', why: 'To build your profile. Photos are resized and have their location metadata stripped.' },
  { item: 'Login timestamps and settings', why: 'To keep your account safe and remember your choices.' },
]

export function Privacy() {
  return (
    <div className="container page container-narrow">
      <div className="page-head">
        <span className="badge">Legal</span>
        <h1 style={{ marginTop: 12 }}>Privacy policy</h1>
        <p>
          What the accounts module stores, why it stores it, and the controls you have over it.
          Written to match what this build actually does.
        </p>
      </div>

      <div className="stack">
        <Card>
          <CardHead title="What we store and why" />
          <CardBody>
            <dl className="detail-list">
              {COLLECTED.map((row) => (
                <div className="detail" key={row.item}>
                  <dt>{row.item}</dt>
                  <dd>{row.why}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="What other people can see" />
          <CardBody>
            <p>
              Your profile card shows your first name, photo, age, city and interests - and only what
              you leave switched on. Your email, phone number, birth date and dating preferences are
              never shown to other members.
            </p>
            <ul className="checklist" style={{ listStyle: 'none', padding: 0, marginTop: 14 }}>
              {[
                'Settings → Privacy: public, matches only, or fully private',
                'Hide your age or your location independently',
                'Switch off appearing in discovery without deleting anything',
                'Choose who is allowed to message you',
              ].map((line) => (
                <li key={line} className="check-item" data-done>
                  <span className="check-dot" aria-hidden="true">
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Security" />
          <CardBody>
            <p>
              Passwords are hashed with bcrypt. Sessions use signed tokens; changing your password or
              choosing "sign out of all devices" invalidates every token already issued for your
              account. Photo uploads are limited by size and type, then re-encoded so nothing hidden
              inside the original file survives.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Deleting your data" />
          <CardBody>
            <p>
              Deactivating hides your profile and can be undone by signing in again. Deleting your
              account removes your profile row and, with it, your photo reference, interests,
              preferences and settings. Ask us to delete the stored image files too and we will.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <Button to="/settings">Open account settings</Button>
              <Button variant="outline" to="/terms">
                Read the terms
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default Privacy

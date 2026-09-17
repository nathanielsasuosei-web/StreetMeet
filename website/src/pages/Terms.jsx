import { Card, CardBody, CardHead } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function Terms() {
  return (
    <div className="container page container-narrow">
      <div className="page-head">
        <span className="badge">Legal</span>
        <h1 style={{ marginTop: 12 }}>Terms of service</h1>
        <p>
          The short version of what you are agreeing to when you create a StreetMeet account. This
          page ships with the user accounts module - have a lawyer review it before launch.
        </p>
      </div>

      <div className="stack">
        <Card>
          <CardHead title="1. Who can use StreetMeet" />
          <CardBody>
            <p>
              You must be 18 or older. We derive your age from the birth date on your profile and
              refuse sign-ups that would make you younger than 18. One account per person; you are
              responsible for everything done with your login details.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="2. Your profile" />
          <CardBody>
            <p>
              You agree that the name, photo, bio, interests and location you add are honestly yours.
              You keep ownership of what you upload, and you give us permission to store and display
              it to other members according to the visibility settings you choose.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="3. Behaviour" />
          <CardBody>
            <p>
              No harassment, hate, spam, impersonation, nudity involving anyone without consent, or
              attempts to scrape member data. Accounts that break these rules can be deactivated or
              deleted without notice.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="4. Your account is yours to close" />
          <CardBody>
            <p>
              You can deactivate your account at any time (it hides your profile and can be undone by
              signing in again) or delete it permanently from Settings → Security &amp; closure.
              Deletion removes your profile, photo, interests, preferences and settings.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="5. Availability" />
          <CardBody>
            <p>
              This build covers user accounts. Matching, messaging, status and payments are separate
              modules that are not part of it yet, and those areas of the app say so plainly instead
              of pretending to work.
            </p>
          </CardBody>
        </Card>

        <div className="row">
          <Button to="/register">Create an account</Button>
          <Button variant="outline" to="/privacy">
            Read the privacy policy
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Terms

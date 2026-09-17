import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'

export function NotFound() {
  return (
    <div className="container page container-narrow">
      <Card>
        <CardBody>
          <div className="stack" style={{ textAlign: 'center', padding: '20px 0' }}>
            <span className="badge">404</span>
            <h1>That page does not exist</h1>
            <p className="muted">
              The link may be old, or the page may have moved. Your profile and settings are still
              exactly where you left them.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button to="/">Back to home</Button>
              <Button variant="outline" to="/profile">
                My profile
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default NotFound

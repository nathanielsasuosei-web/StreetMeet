import { Link } from 'react-router-dom'

import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    icon: '🪪',
    title: 'A profile that says something',
    body: 'Age, city, bio and interests - the four things that actually decide whether you click with someone.',
  },
  {
    icon: '🎯',
    title: 'Preferences you control',
    body: 'Choose who you want to meet, the age range, how far you are willing to go, and what you are looking for.',
  },
  {
    icon: '📸',
    title: 'One good photo is enough',
    body: 'Upload a photo and we resize it, strip the location data, and put it on your profile card.',
  },
  {
    icon: '🛡️',
    title: 'Private by default',
    body: 'Hide your age, hide your city, go invisible in discovery, or lock your profile to matches only.',
  },
  {
    icon: '✏️',
    title: 'Change anything, any time',
    body: 'Every field on your profile is editable, and your settings save as soon as you flip a switch.',
  },
  {
    icon: '🔐',
    title: 'Account security that works',
    body: 'Change your password and every other device is signed out. Deactivate, then come back whenever.',
  },
]

const STEPS = [
  { title: 'Create your account', body: 'Name, email and a password. That is the whole sign-up form.' },
  { title: 'Build your profile', body: 'A six-step setup: gender, age, city, interests, bio, preferences, photo.' },
  { title: 'Meet people', body: 'Discovery, matching and messaging are the next modules on the roadmap.' },
]

const SAMPLE_MEMBERS = [
  { name: 'Ama Serwaa', detail: '26 · Accra', interests: 'Design · Coffee · Live music' },
  { name: 'Kwame Mensah', detail: '29 · Accra', interests: 'Tech · Running · Cooking' },
  { name: 'Efua Boateng', detail: '27 · London', interests: 'Art · Board games · Brunch' },
]

export function Home() {
  const { isAuthenticated, user, profileComplete } = useAuth()

  return (
    <>
      <section className="container hero">
        <div>
          <span className="badge badge-accent">Dating, minus the noise</span>
          <h1 style={{ marginTop: 16 }}>Meet people who actually live around you.</h1>
          <p>
            StreetMeet is built on the simple stuff: who you are, what you are into, and who you want
            to meet. Create a profile in a minute and stay in control of everything on it.
          </p>

          <div className="row hero-cta">
            {isAuthenticated ? (
              <>
                <Button size="lg" to={profileComplete ? '/profile' : '/onboarding'}>
                  {profileComplete ? 'Go to my profile' : 'Finish your profile'}
                </Button>
                <Button size="lg" variant="outline" to="/settings">
                  Account settings
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" to="/register">
                  Create your account
                </Button>
                <Button size="lg" variant="outline" to="/login">
                  Log in
                </Button>
              </>
            )}
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>18+</strong>
              <span>Members only</span>
            </div>
            <div className="hero-stat">
              <strong>44</strong>
              <span>Interests to choose from</span>
            </div>
            <div className="hero-stat">
              <strong>6</strong>
              <span>Setup steps</span>
            </div>
          </div>

          {isAuthenticated && user ? (
            <p className="small muted" style={{ marginTop: 20 }}>
              Signed in as <strong className="strong">{user.email}</strong> ·{' '}
              <Link to="/profile">view profile</Link>
            </p>
          ) : null}
        </div>

        <div className="hero-art" aria-hidden="true">
          {SAMPLE_MEMBERS.map((member) => (
            <div className="hero-card" key={member.name}>
              <Avatar name={member.name} size="md" />
              <div className="hero-card-copy">
                <strong>{member.name}</strong>
                <span>{member.detail}</span>
                <span>{member.interests}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Everything you need to be found</h2>
          <p>
            This build covers the full user accounts module: sign up and login, profile creation,
            profile photo, age, location, bio, interests, gender and dating preferences, edit
            profile, and account settings.
          </p>
        </div>

        <div className="grid-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="feature">
              <div className="feature-icon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>How it works</h2>
        </div>

        <div className="grid-3">
          {STEPS.map((step, index) => (
            <Card key={step.title}>
              <CardBody>
                <span className="wizard-index" style={{ marginBottom: 12 }} aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p className="muted small">{step.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="container section">
        <Card>
          <CardBody>
            <div className="row-between">
              <div>
                <h2>Ready when you are.</h2>
                <p className="muted">
                  Free to join. Your photo, age and city stay private until you decide otherwise.
                </p>
              </div>
              <div className="row">
                {isAuthenticated ? (
                  <Button size="lg" to="/profile">
                    Open my profile
                  </Button>
                ) : (
                  <>
                    <Button size="lg" to="/register">
                      Create account
                    </Button>
                    <Button size="lg" variant="outline" to="/login">
                      Log in
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </section>
    </>
  )
}

export default Home

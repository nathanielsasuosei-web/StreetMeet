/**
 * npm run test:ui
 *
 * Drives the real React app in a real DOM (jsdom), against the real backend,
 * and walks the whole user accounts flow the way a member would:
 *
 *   home -> register -> onboarding wizard (6 steps) -> profile
 *        -> settings (privacy toggle) -> edit profile -> sign out
 *
 * The backend must be running (default http://127.0.0.1:5000, override with
 * BACKEND_URL). Exits non-zero on the first failed expectation.
 */
import { JSDOM } from 'jsdom'

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:5000'
const ORIGIN = 'http://localhost:5173'

/* ── harness ───────────────────────────────────────────────────────────── */
let passed = 0
const failures = []
const consoleErrors = []

async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  \u001b[32m✓\u001b[0m ${name}`)
  } catch (error) {
    failures.push(name)
    console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

function assertText(haystack, needle, label) {
  assert(
    String(haystack).includes(needle),
    `${label || 'page'} should contain "${needle}" (got: ${String(haystack).slice(0, 160)}…)`,
  )
}

/* ── is the API up? ────────────────────────────────────────────────────── */
const nodeFetch = globalThis.fetch
try {
  const health = await nodeFetch(`${BACKEND}/api/health`)
  if (!health.ok) throw new Error(`health responded ${health.status}`)
} catch (error) {
  console.error(
    `\n❌ Cannot reach the StreetMeet API at ${BACKEND} (${error.message}).\n` +
      '   Start it first:  cd backend && npm run db:setup && npm start\n',
  )
  process.exit(1)
}

/* ── DOM environment ───────────────────────────────────────────────────── */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: `${ORIGIN}/`,
  pretendToBeVisual: true,
})
const { window } = dom

const requests = []

/** Node 22 defines some globals as getters (navigator), so assign defensively. */
function expose(name, value) {
  try {
    globalThis[name] = value
  } catch {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
}

expose('window', window)
expose('document', window.document)
expose('navigator', window.navigator)
expose('location', window.location)
expose('history', window.history)
expose('localStorage', window.localStorage)
expose('HTMLElement', window.HTMLElement)
expose('HTMLInputElement', window.HTMLInputElement)
expose('HTMLTextAreaElement', window.HTMLTextAreaElement)
expose('HTMLSelectElement', window.HTMLSelectElement)
expose('Element', window.Element)
expose('Node', window.Node)
expose('Event', window.Event)
expose('MouseEvent', window.MouseEvent)
expose('KeyboardEvent', window.KeyboardEvent)
expose('getComputedStyle', window.getComputedStyle)
expose('requestAnimationFrame', window.requestAnimationFrame || ((cb) => setTimeout(cb, 0)))
expose('cancelAnimationFrame', window.cancelAnimationFrame || clearTimeout)
expose('IS_REACT_ACT_ENVIRONMENT', true)


window.scrollTo = () => {}

// The app runs in Node's module context here, so it resolves `URL` to Node's
// global (in a browser it would be the window's). Stub both.
for (const target of [window.URL, globalThis.URL]) {
  target.createObjectURL = () => 'blob:mock'
  target.revokeObjectURL = () => {}
}
window.matchMedia =
  window.matchMedia ||
  ((query) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }))

/* The app uses relative URLs (Vite proxies them in the browser); here we point
   them straight at the API and record every call. */
globalThis.fetch = async (input, init = {}) => {
  const target = String(input).startsWith('http') ? String(input) : `${BACKEND}${String(input)}`
  const record = { method: init.method || 'GET', path: target.replace(BACKEND, ''), status: null }
  requests.push(record)

  // The app builds its FormData with Node's global but fills it with a jsdom
  // File, whose stream undici cannot read. Rebuild the body with Node types.
  let options = init
  const body = init.body
  if (body && typeof body.entries === 'function') {
    const nodeForm = new FormData()
    for (const [key, value] of body.entries()) {
      if (value instanceof Blob) {
        nodeForm.append(key, value, value.name || 'upload')
      } else if (value && typeof value.arrayBuffer === 'function') {
        const started = Date.now()
        const bytes = Buffer.from(await value.arrayBuffer())
        record.readMs = Date.now() - started
        record.bytes = bytes.length
        nodeForm.append(key, new Blob([bytes], { type: value.type }), value.name || 'upload')
      } else {
        nodeForm.append(key, value)
      }
    }
    options = { ...init, body: nodeForm }
  }

  try {
    const response = await nodeFetch(target, options)
    record.status = response.status
    return response
  } catch (error) {
    record.error = error.message
    throw error
  }
}

const originalError = console.error
console.error = (...args) => {
  consoleErrors.push(args.map(String).join(' '))
  originalError(...args)
}

/* ── load the app through Vite (JSX transform, no build step) ──────────── */
const { createServer } = await import('vite')
const reactPlugin = (await import('@vitejs/plugin-react')).default

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: 'warn',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  plugins: [reactPlugin()],
})

// React itself comes from Node (Vite externalises bare deps for SSR, so the
// app modules and this script share one instance). Only /src goes through Vite.
const reactModule = await import('react')
const React = reactModule.default ?? reactModule
const reactDomClient = await import('react-dom/client')
const createRoot = reactDomClient.createRoot ?? reactDomClient.default.createRoot
const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
const { AuthProvider } = await vite.ssrLoadModule('/src/context/AuthContext.jsx')
const { ToastProvider } = await vite.ssrLoadModule('/src/context/ToastContext.jsx')

const act = React.act ?? reactModule.act

/* ── interaction helpers ───────────────────────────────────────────────── */
const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]
const text = () => document.body.textContent.replace(/\s+/g, ' ')
const path = () => window.location.pathname

const byText = (selector, needle) =>
  $$(selector).find((element) => element.textContent.replace(/\s+/g, ' ').includes(needle))

async function settle(ms = 40) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

async function click(element, label = 'element') {
  assert(element, `nothing to click for "${label}"`)
  await act(async () => {
    element.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    )
  })
  await settle()
}

function setValue(element, value) {
  assert(element, 'setValue: element not found')
  const proto =
    element instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : element instanceof window.HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype

  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)

  if (element instanceof window.HTMLInputElement && element.type === 'checkbox') {
    Object.getOwnPropertyDescriptor(proto, 'checked').set.call(element, value === true || value === 'true')
    element.dispatchEvent(new window.Event('click', { bubbles: true }))
    return
  }

  element.dispatchEvent(
    new window.Event(element instanceof window.HTMLSelectElement ? 'change' : 'input', {
      bubbles: true,
    }),
  )
}

async function fill(selector, value) {
  const element = $(selector)
  assert(element, `input ${selector} not found`)
  await act(async () => {
    setValue(element, value)
  })
  await settle(10)
}

async function submitForm(buttonText) {
  const button = byText('button[type="submit"]', buttonText)
  assert(button, `submit button "${buttonText}" not found`)
  const form = button.closest('form')
  assert(form, `no form around the "${buttonText}" button`)
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
  await settle(60)
}

/** Poll until `predicate` holds - the API hashes passwords, so wait for it. */
async function waitFor(predicate, { timeout = 8000, label = 'condition' } = {}) {
  const started = Date.now()
  for (;;) {
    if (predicate()) return true
    if (Date.now() - started > timeout) {
      if (process.env.UI_SMOKE_DEBUG) {
        console.warn(`[ui-smoke] gave up after ${timeout}ms waiting for: ${label}`)
      }
      return false
    }
    await settle(60)
  }
}

const calledApi = (method, pathPart) =>
  requests.some((request) => request.method === method && request.path.includes(pathPart))

/* ── run ───────────────────────────────────────────────────────────────── */
console.log(`\nStreetMeet UI smoke test - ${ORIGIN} -> ${BACKEND}\n`)

const root = createRoot(document.getElementById('root'))
await act(async () => {
  root.render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(AuthProvider, null, React.createElement(App)),
    ),
  )
})
await settle(80)

await check('home page renders the landing copy', () => {
  assertText(text(), 'Meet people who actually live around you', 'home')
  assertText(text(), 'Create your account', 'home CTA')
})

await click(byText('a.btn', 'Create your account'), 'create account CTA')

await check('register page renders the sign-up form', () => {
  assert(path() === '/register', `expected /register, got ${path()}`)
  assert($('#fullName'), 'full name input missing')
  assert($('#password'), 'password input missing')
})

await check('register blocks a weak password with an inline error', async () => {
  await fill('#fullName', 'UI Smoke')
  await fill('#email', 'weak@example.com')
  await fill('#password', 'abc')
  await fill('#confirmPassword', 'abc')
  await submitForm('Create account')
  assertText(text(), 'At least 8 characters', 'password validation')
})

const email = `ui-smoke+${Date.now()}@streetmeet.dev`

await fill('#fullName', 'UI Smoke Tester')
await fill('#email', email)
await fill('#password', 'Street1234')
await fill('#confirmPassword', 'Street1234')
await act(async () => {
  setValue($('input[name="acceptTerms"]'), true)
})
await settle()

await submitForm('Create account')
await waitFor(() => path() === '/onboarding' && text().includes('Create your profile'), {
  label: 'redirect to the wizard',
})

await check('signing up creates the account and opens the wizard', () => {
  assert(
    calledApi('POST', '/api/auth/register'),
    'expected POST /api/auth/register to be called',
  )
  assert(path() === '/onboarding', `expected /onboarding, got ${path()} (body: ${text().slice(0, 120)})`)
  assertText(text(), 'Create your profile', 'wizard heading')
})

/* step 1 - identity */
await click(byText('button.option-card', 'Woman'), 'gender option')
await fill('#birthDate', '1997-05-04')
await check('step 1 shows the derived age, not the birth date', () => {
  assertText(text(), 'You are 29', 'age hint')
})
await click(byText('button', 'Continue'), 'continue to location')

/* step 2 - location */
await check('step 2 asks for the city', () => assertText(text(), 'Where are you based', 'location step'))
await fill('#city', 'Accra')
await act(async () => {
  setValue($('#country'), 'Ghana')
})
await settle()
await click(byText('button', 'Continue'), 'continue to interests')

/* step 3 - interests */
await check('step 3 enforces the minimum number of interests', () => {
  assertText(text(), 'minimum 3', 'interest counter')
})
await click(byText('button.chip', 'Coffee'), 'interest: coffee')
await click(byText('button.chip', 'Music'), 'interest: music')
await click(byText('button.chip', 'Travel'), 'interest: travel')
await click(byText('button', 'Continue'), 'continue to bio')

/* step 4 - bio */
await check('step 4 rejects a bio that is too short', () => {
  assertText(text(), 'Say something about yourself', 'bio step')
})
await fill('#bio', 'Short')
await click(byText('button', 'Continue'), 'continue with a short bio')
await check('the wizard explains why the bio was refused', () => {
  assertText(text(), 'at least 20 characters', 'bio validation')
})
await fill('#bio', 'Testing the sign-up wizard end to end, one careful step at a time.')
await click(byText('button', 'Continue'), 'continue to preferences')

/* step 5 - preferences */
await check('step 5 shows the dating preference controls', () => {
  assertText(text(), 'Who do you want to meet', 'preferences step')
  assertText(text(), 'Age range', 'age range control')
})
await click(byText('button.chip', '50 km'), 'distance chip')
await click(byText('button.option-card', 'Dating'), 'relationship goal')
await click(byText('button', 'Continue'), 'continue to photo')

/* step 6 - photo (skipped) */
await check('step 6 offers the photo upload', () => {
  assertText(text(), 'Add your photo', 'photo step')
  assertText(text(), 'Add your photo', 'photo dropzone')
})
await click(byText('button', 'Skip photo'), 'finish without a photo')
await waitFor(() => path() === '/profile', { label: 'redirect to the profile' })

await check('finishing the wizard saves the profile and lands on /profile', () => {
  assert(calledApi('POST', '/api/profile/onboard'), 'expected POST /api/profile/onboard')
  assert(path() === '/profile', `expected /profile, got ${path()}`)
  assertText(text(), 'Your profile', 'profile page')
})

await check('the profile shows the details just entered', () => {
  assertText(text(), 'UI Smoke Tester', 'name')
  assertText(text(), 'Accra, Ghana', 'location')
  assertText(text(), '29', 'age')
  assertText(text(), 'Interested in', 'preferences card')
})

await check('the profile flags the only missing field: the photo', () => {
  assertText(text(), 'Finish your profile', 'completion banner')
  assertText(text(), 'Add a profile photo', 'missing photo')
})

/* settings */
await click(byText('a.btn, button.btn', 'Settings'), 'settings button')
await waitFor(() => text().includes('Account settings'), { label: 'settings to load' })
await settle(60)

await check('settings loads the account overview', () => {
  assert(path() === '/settings', `expected /settings, got ${path()}`)
  assertText(text(), 'Account settings', 'settings heading')
  assertText(text(), email, 'account email')
})

await click(byText('button.tab', 'Privacy & visibility'), 'privacy tab')

await check('privacy tab lists the visibility options', () => {
  assertText(text(), 'Profile visibility', 'visibility section')
  assertText(text(), 'Matches only', 'visibility option')
})

const switchCountBefore = requests.filter((r) => r.path === '/api/settings' && r.method === 'PATCH').length
await click($('button[role="switch"]'), 'first privacy switch')
await waitFor(
  () => requests.filter((r) => r.path === '/api/settings' && r.method === 'PATCH').length > switchCountBefore,
  { label: 'settings PATCH' },
)

await check('flipping a switch persists it immediately', () => {
  assert(calledApi('PATCH', '/api/settings'), 'expected PATCH /api/settings')
})

await click(byText('button.option-card', 'Matches only'), 'visibility option')
await waitFor(
  () => requests.filter((r) => r.path === '/api/settings' && r.method === 'PATCH').length > switchCountBefore + 1,
  { label: 'visibility PATCH' },
)

await check('changing visibility persists too', () => {
  const patches = requests.filter((request) => request.path.includes('/api/settings'))
  assert(patches.length >= 2, `expected at least 2 settings patches, saw ${patches.length}`)
})

/* edit profile */
await click(byText('button.tab', 'Account'), 'back to account tab')
await act(async () => {
  window.history.pushState({}, '', '/profile/edit')
  window.dispatchEvent(new window.PopStateEvent('popstate'))
})
await settle(150)

await check('edit profile renders every editable field', () => {
  assert(path() === '/profile/edit', `expected /profile/edit, got ${path()}`)
  assert($('#edit-fullName'), 'name input missing')
  assert($('#edit-bio'), 'bio input missing')
  assert($('#edit-city'), 'city input missing')
  assertText(text(), 'Dating preferences', 'preferences card')
})

await fill('#edit-bio', 'Updated by the UI smoke test - still testing the whole flow end to end.')
await click(byText('button', 'Save details'), 'save details')
await waitFor(() => text().includes('Profile saved'), { label: 'save confirmation' })

await check('saving the profile patches the API and confirms with a toast', () => {
  assert(calledApi('PATCH', '/api/profile/me'), 'expected PATCH /api/profile/me')
  assertText(text(), 'Profile saved', 'success toast')
})

/* photo upload - real multipart request through the PhotoUploader component */
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

await check('the photo uploader sends a multipart upload and shows the result', async () => {
  const input = $('input[type="file"]')
  assert(input, 'photo input missing on the edit page')

  const file = new window.File([Buffer.from(PNG_1PX, 'base64')], 'me.png', { type: 'image/png' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })

  await act(async () => {
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })

  const uploaded = await waitFor(
    () => requests.some((entry) => entry.path.includes('/api/profile/photo') && entry.status !== null),
    { label: 'photo upload response' },
  )
  assert(
    uploaded,
    `POST /api/profile/photo never completed: ${JSON.stringify(requests.filter((e) => e.path.includes('/photo')))}`,
  )

  const record = requests.find((entry) => entry.path.includes('/api/profile/photo'))
  assert(record.status === 200, `upload responded ${record.status}`)

  const shown = await waitFor(() => Boolean($('img[src*="/uploads/profiles/"]')), {
    label: 'uploaded photo to render',
  })
  assert(shown, 'the new photo never appeared in the page')
})


/* ── module 2: discover, match, message, moderate, notify ──────────────── */
const dating = {}

await check('the discover deck loads compatible members', async () => {
  await click(byText('a.nav-link', 'Discover'), 'discover link')
  const loaded = await waitFor(
    () => Boolean($('.profile-card')) || text().includes('No one new right now'),
    { label: 'deck to load' },
  )
  assert(loaded, 'deck never loaded')
  assert(calledApi('GET', '/api/discover/deck'), 'expected GET /api/discover/deck')
  assert($('.profile-card'), `expected a card in the deck (body: ${text().slice(0, 140)})`)
})

await check('passing moves the deck to the next profile', async () => {
  const before = $('.profile-card-overlay strong')?.textContent
  await click($('button[aria-label="Pass"]'), 'pass button')
  const moved = await waitFor(
    () => $('.profile-card-overlay strong')?.textContent !== before || text().includes('No one new right now'),
    { label: 'deck to advance' },
  )
  assert(moved, 'deck did not advance after a pass')
  assert(calledApi('POST', '/api/swipes'), 'expected POST /api/swipes')
})

await check('a mutual like opens the match celebration', async () => {
  // A second throwaway account likes the test account through the API; when
  // the test account likes back in the UI both sides are throwaways, so every
  // trace disappears when the cleanup step deletes both accounts.
  const buddyEmail = `ui-smoke-buddy+${Date.now()}@streetmeet.dev`
  const reg = await nodeFetch(`${BACKEND}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Smoke Buddy',
      email: buddyEmail,
      password: 'Street1234',
      confirmPassword: 'Street1234',
    }),
  })
  const regBody = await reg.json()
  assert(reg.status === 201, `buddy register responded ${reg.status}`)
  dating.buddyToken = regBody.data.token

  const onboard = await nodeFetch(`${BACKEND}/api/profile/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dating.buddyToken}` },
    body: JSON.stringify({
      gender: 'MAN',
      birthDate: '1990-01-01',
      city: 'Accra',
      country: 'Ghana',
      bio: 'Second throwaway smoke account, here to like and be liked back.',
      interests: ['coffee', 'tech', 'travel'],
      interestedIn: ['WOMAN'],
      minAge: 21,
      maxAge: 45,
    }),
  })
  assert(onboard.ok, `buddy onboarding responded ${onboard.status}`)

  const me = await nodeFetch(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${window.localStorage.getItem('streetmeet.token')}` },
  })
  const meBody = await me.json()

  const like = await nodeFetch(`${BACKEND}/api/swipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dating.buddyToken}` },
    body: JSON.stringify({ targetId: meBody.data.user.id, decision: 'LIKE' }),
  })
  assert(like.ok, `buddy like responded ${like.status}`)

  await click(byText('button.segmented-item', 'Search & filters'), 'search mode')
  await fill('input[placeholder="e.g. chef"]', 'Buddy')
  await click(byText('button', 'Search profiles'), 'search button')
  const found = await waitFor(() => Boolean(byText('.profile-grid .profile-card', 'Smoke')), {
    label: 'search result',
  })
  assert(found, 'search did not surface the buddy profile')

  await click(byText('.profile-grid button', 'Like'), 'like button')
  const matched = await waitFor(() => text().includes("It's a match!"), { label: 'match modal' })
  assert(matched, 'the match celebration never appeared')

  const matches = await nodeFetch(`${BACKEND}/api/matches`, {
    headers: { Authorization: `Bearer ${dating.buddyToken}` },
  })
  const matchesBody = await matches.json()
  dating.matchId = matchesBody.data.items[0]?.id
  assert(dating.matchId, 'buddy has no match after the mutual like')

  const sent = await nodeFetch(`${BACKEND}/api/matches/${dating.matchId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dating.buddyToken}` },
    body: JSON.stringify({ content: 'Hello from the other smoke account!' }),
  })
  assert(sent.ok, `buddy message responded ${sent.status}`)

  await click(byText('button', 'Keep discovering'), 'close match modal')
})

await check('the matches list shows the new match with an unread badge', async () => {
  await click(byText('a.nav-link', 'Matches'), 'matches link')
  const shown = await waitFor(() => text().includes('Hello from the other smoke account!'), {
    label: 'match row preview',
  })
  assert(shown, 'the match row preview is missing')
  assert($('.badge-unread'), 'expected an unread badge on the match row')
})

await check('the conversation renders the thread and sends a reply', async () => {
  await click($('.match-row'), 'match row')
  const shown = await waitFor(() => text().includes('Hello from the other smoke account!'), {
    label: 'partner message',
  })
  assert(shown, 'partner message missing in the thread')
  assert(path().startsWith('/matches/'), `expected a conversation route, got ${path()}`)

  await fill('.conversation-composer textarea', 'And hello back - matched inside a test!')
  await click(byText('button', 'Send'), 'send button')
  const sent = await waitFor(() => $$('.bubble').length >= 2, { label: 'reply bubble' })
  assert(sent, 'the reply never rendered')
})

await check('reading the thread clears the unread badge', async () => {
  await click(byText('a.nav-link', 'Matches'), 'matches link')
  const cleared = await waitFor(() => !$('.badge-unread'), { label: 'badge to clear' })
  assert(cleared, 'the unread badge survived reading the thread')
})

await check('the notification centre lists like, match and message', async () => {
  await click($('a.nav-bell'), 'notification bell')
  const loaded = await waitFor(
    () => text().includes('liked you') && text().includes('matched with'),
    { label: 'notifications to load' },
  )
  assert(loaded, 'expected like and match notifications')
  assertText(text(), 'Hello from the other smoke account!', 'message preview')
  const badged = await waitFor(() => Boolean($('.nav-bell-badge')), { label: 'bell badge' })
  assert(badged, 'the bell should show unread before marking')

  await click(byText('button', 'Mark all read'), 'mark all read')
  const cleared = await waitFor(() => !$('.nav-bell-badge') && !$('.notification-row.unread'), {
    label: 'unread state to clear',
  })
  assert(cleared, 'unread state survived mark-all-read')
})

await check('blocking from the conversation closes the match', async () => {
  await click(byText('a.nav-link', 'Matches'), 'matches link')
  await click($('.match-row'), 'match row')
  await click(byText('button', '⋯'), 'conversation menu')
  await click(byText('button[role="menuitem"]', 'Block member'), 'block menu item')
  await click(byText('.modal-foot button', 'Block'), 'confirm block')
  const gone = await waitFor(
    () => path() === '/matches' && (text().includes('No matches yet') || !$('.match-row')),
    { label: 'match to disappear' },
  )
  assert(gone, 'blocking did not remove the match')
})

await check('settings lists blocked members and can unblock them', async () => {
  await act(async () => {
    window.history.pushState({}, '', '/settings')
    window.dispatchEvent(new window.PopStateEvent('popstate'))
  })
  await settle(120)
  await click(byText('button.tab', 'Privacy & visibility'), 'privacy tab')
  const listed = await waitFor(() => text().includes('Smoke Buddy'), { label: 'blocked list' })
  assert(listed, 'the blocked member is not listed')
  await click(byText('button', 'Unblock'), 'unblock button')
  const emptied = await waitFor(() => text().includes('You have not blocked anyone.'), {
    label: 'empty blocked list',
  })
  assert(emptied, 'unblocking did not clear the list')
})

await check('search filters exclude people outside the filters', async () => {
  await click(byText('a.nav-link', 'Discover'), 'discover link')
  await click(byText('button.segmented-item', 'Search & filters'), 'search mode')
  await fill('input[placeholder="e.g. chef"]', 'Buddy')
  await fill('input[placeholder="e.g. Accra"]', 'Lagos')
  await click(byText('button', 'Search profiles'), 'search button')
  const empty = await waitFor(() => text().includes('Nobody fits those filters'), {
    label: 'empty search results',
  })
  assert(empty, 'the location filter should exclude the Accra buddy')
})

/* ── module 3: plans & paystack (mock) checkout ────────────────────────── */
await check('the plans page lists the three tiers with the free plan active', async () => {
  window.history.pushState({}, '', '/premium')
  window.dispatchEvent(new window.PopStateEvent('popstate'))

  await waitFor(() => text().includes('Plans & billing'), { label: 'plans page' })
  assert(
    requests.some((r) => r.path === '/api/billing/plans' && r.status === 200),
    'the plans endpoint was called (cached module-scoped, once per run)',
  )
  assert(text().includes('Current plan: FREE'), 'free plan badge')
  assert(text().includes('Choose Premium'), 'premium CTA')
  assert(text().includes('Choose VIP'), 'vip CTA')
})

await check('checking out with mobile money upgrades the account (mock Paystack)', async () => {
  await click(byText('button', 'Choose Premium'), 'premium CTA')
  await waitFor(() => text().includes('Payment channel'), { label: 'checkout form' })

  await fill('input[placeholder="0244 000 000"]', '0244000000')
  await click(byText('button', 'Start payment'), 'start payment')
  await waitFor(() => text().includes('Reference'), { label: 'mock approval step' })
  await click(byText('button', 'Simulate approval'), 'simulate approval')

  await waitFor(() => text().includes('is live'), { label: 'activation toast', timeout: 6000 })
  await waitFor(() => text().includes('Current plan: PREMIUM'), { label: 'premium badge' })
  await waitFor(() => text().includes('Active subscription'), { label: 'subscription card' })
  assert(text().includes('PREMIUM'), 'plan chip shows in the shell')
})

await check('premium unlocks the advanced filters in discover', async () => {
  requests.length = 0
  window.history.pushState({}, '', '/discover')
  window.dispatchEvent(new window.PopStateEvent('popstate'))

  await waitFor(() => Boolean(byText('button.segmented-item', 'Search & filters')), {
    label: 'search mode toggle',
  })
  await click(byText('button.segmented-item', 'Search & filters'), 'search mode')
  await waitFor(() => text().includes('Shared interests'), { label: 'filters card' })

  const interestBox = $$('.field').find((box) => box.textContent.includes('Shared interests'))
  await click(interestBox.querySelector('button'), 'interest chip')
  await click(byText('button', 'Search profiles'), 'search button')

  await waitFor(
    () =>
      requests.some(
        (r) =>
          r.path.startsWith('/api/discover/search') &&
          r.path.includes('interests=') &&
          r.status === 200,
      ),
    { label: 'premium search request' },
  )
})

/* leave the database as we found it: delete the account this run created */
await check('the account created by this test run can delete itself', async () => {
  const token = window.localStorage.getItem('streetmeet.token')
  assert(token, 'no token stored for the test account')

  const response = await nodeFetch(`${BACKEND}/api/settings/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password: 'Street1234', mode: 'delete', confirmText: 'DELETE' }),
  })
  const payload = await response.json()
  assert(response.status === 200, `delete responded ${response.status}: ${payload.message}`)
  assert(payload.data.deleted === true, 'expected a permanent deletion')

  if (dating.buddyToken) {
    const buddyDelete = await nodeFetch(`${BACKEND}/api/settings/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dating.buddyToken}` },
      body: JSON.stringify({ password: 'Street1234', mode: 'delete', confirmText: 'DELETE' }),
    })
    assert(buddyDelete.ok, `buddy delete responded ${buddyDelete.status}`)
  }
})

/* sign out */
await act(async () => {
  window.history.pushState({}, '', '/profile')
  window.dispatchEvent(new window.PopStateEvent('popstate'))
})
await settle(120)

const avatarButton = $('header .nav-actions button[aria-haspopup="menu"]')
await click(avatarButton, 'avatar menu')
await click(byText('button[role="menuitem"]', 'Sign out'), 'sign out')

await check('signing out returns to the public home page', () => {
  assert(path() === '/', `expected /, got ${path()}`)
  assertText(text(), 'Create your account', 'signed-out CTA')
})

/* ── module 4: admin control panel ───────────────────────────────────────── */
await check('staff sign in and land on the admin control panel', async () => {
  requests.length = 0
  window.history.pushState({}, '', '/login')
  window.dispatchEvent(new window.PopStateEvent('popstate'))
  await waitFor(() => Boolean($('#login-email')), { label: 'login form' })

  await fill('#login-email', 'nana@streetmeet.dev')
  await fill('#login-password', 'Street1234')
  await submitForm('Log in')

  await waitFor(() => Boolean(byText('a.nav-link', 'Admin')), { label: 'admin nav link' })
  await click(byText('a.nav-link', 'Admin'), 'admin link')
  await waitFor(() => text().includes('Admin control panel'), { label: 'admin page' })
  await waitFor(() => text().includes('Revenue') && text().includes('Open reports'), {
    label: 'statistics tiles',
  })
  assert(
    requests.some((r) => r.path === '/api/admin/stats' && r.status === 200),
    'the stats endpoint served the panel',
  )
})

await check('the members tab searches, suspends and reinstates', async () => {
  await click(byText('button.segmented-item', 'Members'), 'members tab')
  await waitFor(() => Boolean($('input[placeholder="Search name, email or city"]')), {
    label: 'member search input',
  })

  await fill('input[placeholder="Search name, email or city"]', 'Ama')
  await click(byText('button', 'Search'), 'member search button')
  await waitFor(() => text().includes('ama@streetmeet.dev'), { label: 'search result' })

  await click(byText('button', 'Suspend'), 'suspend button')
  await waitFor(() => text().includes('SUSPENDED'), { label: 'suspended badge' })

  await click(byText('button', 'Reinstate'), 'reinstate button')
  await waitFor(() => !text().includes('SUSPENDED'), { label: 'account reinstated' })
})

await check('the moderation tabs render reports, payments, interests and announcements', async () => {
  await click(byText('button.segmented-item', 'Reports'), 'reports tab')
  await waitFor(() => text().includes('Reported accounts'), { label: 'reports tab' })

  await click(byText('button.segmented-item', 'Subscriptions & payments'), 'payments tab')
  await waitFor(() => text().includes('Every Paystack charge'), { label: 'payments tab' })

  await click(byText('button.segmented-item', 'Interests'), 'interests tab')
  await waitFor(() => text().includes('Dating categories'), { label: 'interests tab' })
  await waitFor(() => text().includes('Coffee'), { label: 'catalogue loaded from the API' })

  await click(byText('button.segmented-item', 'Announcements'), 'announcements tab')
  await waitFor(() => text().includes('Send announcement'), { label: 'announcements tab' })
})

await check('no unexpected React errors were logged', () => {
  const serious = consoleErrors.filter(
    (line) =>
      !line.includes('not wrapped in act') &&
      !line.includes('Not implemented') &&
      !line.includes('useLayoutEffect does nothing on the server'),
  )
  assert(serious.length === 0, `console.error was called: ${serious.slice(0, 3).join(' | ')}`)
})

/* ── teardown ──────────────────────────────────────────────────────────── */
await act(async () => root.unmount())
await vite.close()
await dom.window.close()

console.log(
  `\n${failures.length === 0 ? '\u001b[32m' : '\u001b[31m'}${passed} passed, ${failures.length} failed\u001b[0m` +
    ` · ${requests.length} API calls observed\n`,
)
process.exit(failures.length === 0 ? 0 : 1)

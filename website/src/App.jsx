import { useEffect, useMemo, useRef, useState } from 'react'
import heroPhoto from './assets/studio-hero.jpg'
import './App.css'

const initialBeats = [
  {
    id: 'beat-palmwine',
    title: 'Palmwine at 2AM',
    genre: 'Afrobeats',
    bpm: 98,
    key: 'C♯ minor',
    price: 280,
    tag: 'NEW DROP',
    artwork: 'art-palmwine',
    coverLine: 'AFTER HOURS',
  },
  {
    id: 'beat-neon',
    title: 'Neon Prayer',
    genre: 'R&B / Alté',
    bpm: 108,
    key: 'F minor',
    price: 320,
    tag: 'FAN FAVOURITE',
    artwork: 'art-neon',
    coverLine: 'SAY IT SOFT',
  },
  {
    id: 'beat-nightshift',
    title: 'Night Shift',
    genre: 'Drill',
    bpm: 142,
    key: 'G minor',
    price: 300,
    tag: '',
    artwork: 'art-nightshift',
    coverLine: 'NO SLEEP CLUB',
  },
  {
    id: 'beat-softlife',
    title: 'Soft Life, No Stress',
    genre: 'Amapiano',
    bpm: 113,
    key: 'A minor',
    price: 280,
    tag: 'JUST ADDED',
    artwork: 'art-softlife',
    coverLine: 'TAKE YOUR TIME',
  },
]

const initialVideos = [
  {
    id: 'visual-session',
    title: 'Inside the session: Palmwine at 2AM',
    detail: 'A late night, one loop, and a record taking shape.',
    duration: '04:18',
    poster: 'poster-session',
  },
  {
    id: 'visual-process',
    title: 'One loop. Three different moods.',
    detail: 'A little look at how a sound finds its story.',
    duration: '02:46',
    poster: 'poster-process',
  },
]

const readStore = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const writeStore = (key, value) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local persistence is best-effort in this browser-only demo.
  }
}

const formatPrice = (amount) => `GH₵ ${Number(amount || 0).toLocaleString('en-GH')}`
const shortDate = (value) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))

function csrfCookie() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function apiRequest(path, { method = 'GET', body, formData = false } = {}) {
  const headers = {}
  const upperMethod = method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
    if (!csrfCookie()) {
      await fetch('/api/csrf/', { credentials: 'same-origin' })
    }
    const token = csrfCookie()
    if (token) headers['X-CSRFToken'] = token
    if (body && !formData) headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(path, {
    method: upperMethod,
    credentials: 'same-origin',
    headers,
    body: body ? (formData ? body : JSON.stringify(body)) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  return { response, data }
}

function Icon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
  const shapes = {
    arrowRight: <><path d="M4.5 12h14" /><path d="m12.5 5 7 7-7 7" /></>,
    arrowUpRight: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
    play: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14" /><path d="M16 5v14" /></>,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    headphones: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M5 14h2v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" /><path d="M17 14h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2z" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bank: <><path d="m3 9 9-6 9 6" /><path d="M4 10h16" /><path d="M6 10v8" /><path d="M10 10v8" /><path d="M14 10v8" /><path d="M18 10v8" /><path d="M3 21h18" /><path d="M4 18h16" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
    dots: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2 1-.9 1.6-1.5-.5a8 8 0 0 1-1.6.9l-.3 1.6h-1.9l-.3-1.6a8 8 0 0 1-1.6-.9l-1.5.5-.9-1.6 1.2-1a8 8 0 0 1 0-1.9l-1.2-1 .9-1.6 1.5.5a8 8 0 0 1 1.6-.9l.3-1.6h1.9l.3 1.6a8 8 0 0 1 1.6.9l1.5-.5.9 1.6-1.2 1a8 8 0 0 1 0 1.9Z" transform="translate(-1 -1)" /></>,
  }

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shapes[name] || shapes.spark}
    </svg>
  )
}

function Waveform({ count = 26, className = '' }) {
  const heights = [24, 42, 31, 62, 80, 51, 36, 68, 92, 58, 43, 70, 100, 56, 39, 73, 47, 87, 55, 34, 72, 96, 50, 67, 39, 76]
  return (
    <span className={`waveform ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i key={index} style={{ '--bar-height': `${heights[index % heights.length]}%`, '--bar-index': index }} />
      ))}
    </span>
  )
}

function BeatArtwork({ beat, playing = false, onPlay, compact = false }) {
  return (
    <div className={`beat-artwork ${beat.artwork || 'art-upload'} ${compact ? 'is-compact' : ''}`}>
      <div className="art-orbit art-orbit-one" />
      <div className="art-orbit art-orbit-two" />
      <div className="art-sun" />
      <div className="artwork-label"><span>KAIRO</span><span>ORIGINALS · {String(beat.id).slice(-2).toUpperCase()}</span></div>
      <div className="artwork-type"><span>{beat.coverLine || 'ORIGINAL PRODUCTION'}</span><strong>{beat.title}</strong></div>
      <button className="art-play" type="button" onClick={onPlay} aria-label={`${playing ? 'Pause' : 'Play'} ${beat.title}`}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <span className="art-grain" />
    </div>
  )
}

function Dialog({ children, onClose, wide = false, className = '', label }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`dialog ${wide ? 'dialog-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </section>
    </div>
  )
}

function App() {
  const [beats, setBeats] = useState(() => readStore('kairo-beats', initialBeats))
  const [videos, setVideos] = useState(() => readStore('kairo-videos', initialVideos))
  const [user, setUser] = useState(() => readStore('kairo-session', null))
  const [accountProfile, setAccountProfile] = useState(() => readStore('kairo-account', null))
  const [orders, setOrders] = useState(() => readStore('kairo-orders', []))
  const [emails, setEmails] = useState(() => readStore('kairo-emails', []))
  const [subscribers, setSubscribers] = useState(() => readStore('kairo-subscribers', []))
  const [backendOnline, setBackendOnline] = useState(false)
  const [paymentGatewayReady, setPaymentGatewayReady] = useState(false)

  const [category, setCategory] = useState('All beats')
  const [searchTerm, setSearchTerm] = useState('')
  const [playingBeat, setPlayingBeat] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)
  const searchInputRef = useRef(null)
  const audioUploadRef = useRef(null)
  const previewUploadRef = useRef(null)
  const videoUploadRef = useRef(null)
  const paymentReturnHandled = useRef(false)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [authError, setAuthError] = useState('')
  const [pendingBeat, setPendingBeat] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountTab, setAccountTab] = useState('purchases')
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminTab, setAdminTab] = useState('overview')
  const [checkoutBeat, setCheckoutBeat] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('momo')
  const [paymentNetwork, setPaymentNetwork] = useState('MTN Mobile Money')
  const [paymentError, setPaymentError] = useState('')
  const [checkoutReference, setCheckoutReference] = useState('')
  const [paymentDone, setPaymentDone] = useState(null)
  const [activeVideo, setActiveVideo] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    let active = true
    const connectBackend = async () => {
      try {
        const [healthResponse, beatResponse, videoResponse] = await Promise.all([
          fetch('/api/health/', { credentials: 'same-origin' }),
          fetch('/api/beats/', { credentials: 'same-origin' }),
          fetch('/api/videos/', { credentials: 'same-origin' }),
        ])
        if (!healthResponse.ok || !beatResponse.ok || !videoResponse.ok) return
        const [health, remoteBeats, remoteVideos] = await Promise.all([healthResponse.json(), beatResponse.json(), videoResponse.json()])
        if (!active) return
        setBackendOnline(true)
        setPaymentGatewayReady(health.payments === 'configured')
        setBeats(remoteBeats.length ? remoteBeats.map((beat) => ({ ...beat, serverManaged: true })) : initialBeats)
        setVideos(remoteVideos.length ? remoteVideos.map((video) => ({ ...video, serverManaged: true })) : initialVideos)

        const { response: authResponse, data: authData } = await apiRequest('/api/auth/me/')
        if (!active || !authResponse.ok) return
        if (authData.authenticated) {
          setUser(authData.user)
          setAccountProfile(authData.user)
          const { response: orderResponse, data: remoteOrders } = await apiRequest('/api/orders/')
          if (active && orderResponse.ok) setOrders(remoteOrders)
        } else {
          setUser(null)
          setAccountProfile(null)
          setOrders([])
        }
      } catch {
        // The storefront remains fully usable as a local UI preview when Django is not running.
      }
    }
    connectBackend()
    return () => { active = false }
  }, [])

  useEffect(() => {
    writeStore('kairo-beats', beats.map(({ audioUrl: _audioUrl, ...beat }) => beat))
  }, [beats])
  useEffect(() => {
    writeStore('kairo-videos', videos.map(({ mediaUrl: _mediaUrl, ...video }) => video))
  }, [videos])
  useEffect(() => writeStore('kairo-session', user), [user])
  useEffect(() => writeStore('kairo-account', accountProfile), [accountProfile])
  useEffect(() => writeStore('kairo-orders', orders), [orders])
  useEffect(() => writeStore('kairo-emails', emails), [emails])
  useEffect(() => writeStore('kairo-subscribers', subscribers), [subscribers])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    const focusBeatSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusBeatSearch)
    return () => window.removeEventListener('keydown', focusBeatSearch)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!playingBeat?.audioUrl) {
      audio.pause()
      return
    }
    audio.src = playingBeat.audioUrl
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [playingBeat, isPlaying])

  useEffect(() => {
    const url = new URL(window.location.href)
    const reference = url.searchParams.get('reference')
    if (!backendOnline || !reference || paymentReturnHandled.current) return
    paymentReturnHandled.current = true
    apiRequest(`/api/payments/verify/?reference=${encodeURIComponent(reference)}`)
      .then(({ response, data }) => {
        if (!response.ok) {
          setToast(data.error || 'We could not verify this payment yet. Check your account for updates.')
          return
        }
        const order = { ...data.order, downloadUrl: data.download_url }
        setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)])
        setEmails((current) => [{
          id: `receipt-${order.id}`,
          recipient: order.email,
          sender: 'KAIRO Studio',
          subject: `Your beat is ready: ${order.title}`,
          body: `Payment verified. Your order ${order.id} is confirmed. Your download link is ready here and has also been emailed to you.`,
          createdAt: order.paidAt,
          kind: 'receipt',
          downloadUrl: data.download_url,
        }, ...current.filter((email) => email.id !== `receipt-${order.id}`)])
        setPaymentDone({ ...order, audioUrl: data.download_url, audioName: data.audio_name, remoteVerified: true, emailSent: data.email_sent })
        setToast(data.email_sent ? 'Payment verified. Your beat and email receipt are ready.' : 'Payment verified. Your download is ready; check the producer email settings if the receipt is delayed.')
      })
      .catch(() => setToast('Payment verification service is unavailable. Please contact the producer.'))
      .finally(() => {
        url.searchParams.delete('reference')
        url.searchParams.delete('trxref')
        url.searchParams.delete('payment_return')
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
      })
  }, [backendOnline])

  const availableCategories = useMemo(() => ['All beats', ...new Set(beats.map((beat) => beat.genre).filter(Boolean))], [beats])
  const visibleBeats = useMemo(() => beats.filter((beat) => {
    const matchesCategory = category === 'All beats' || beat.genre === category
    const search = searchTerm.trim().toLowerCase()
    const matchesSearch = !search || `${beat.title} ${beat.genre} ${beat.key}`.toLowerCase().includes(search)
    return matchesCategory && matchesSearch
  }), [beats, category, searchTerm])
  const myOrders = useMemo(() => orders.filter((order) => user && order.email?.toLowerCase() === user.email.toLowerCase()), [orders, user])
  const myEmails = useMemo(() => emails.filter((email) => user && (email.recipient === user.email || email.recipient === 'all')), [emails, user])
  const paystackLiveForSelectedBeat = backendOnline && paymentGatewayReady && checkoutBeat?.serverManaged

  const notify = (message) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3400)
  }

  const scrollTo = (id) => {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleTrack = (beat) => {
    if (!beat.audioUrl) {
      notify('No preview audio is attached to this sample yet. Upload a beat in Producer Studio to hear it.')
      return
    }
    if (playingBeat?.id === beat.id) {
      setIsPlaying((current) => !current)
      return
    }
    setPlayingBeat(beat)
    setProgress(0)
    setIsPlaying(true)
  }

  const openPurchase = (beat) => {
    if (!user) {
      setPendingBeat(beat)
      setAuthError('')
      setAuthMode(accountProfile ? 'login' : 'signup')
      setAuthOpen(true)
      return
    }
    setPaymentMethod('momo')
    setPaymentError('')
    setCheckoutReference(`KAIRO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
    setCheckoutBeat(beat)
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') || '').trim().toLowerCase()
    const name = String(data.get('name') || '').trim()
    const password = String(data.get('password') || '')
    let artist

    if (backendOnline) {
      try {
        const endpoint = authMode === 'signup' ? '/api/auth/signup/' : '/api/auth/login/'
        const payload = authMode === 'signup' ? { name, email, password } : { email, password }
        const { response, data: result } = await apiRequest(endpoint, { method: 'POST', body: payload })
        if (!response.ok) {
          setAuthError(result.error || 'We could not sign you in. Please try again.')
          return
        }
        artist = result.user
      } catch {
        setAuthError('The account service could not be reached. Please try again in a moment.')
        return
      }
    } else if (authMode === 'signup') {
      if (password.length < 10) {
        setAuthError('Use at least 10 characters for your password.')
        return
      }
      artist = { name, email, createdAt: new Date().toISOString() }
    } else {
      const savedArtist = accountProfile || readStore('kairo-account', null)
      if (!savedArtist || savedArtist.email.toLowerCase() !== email) {
        setAuthError('We couldn’t find that artist account in this browser. Create an account to continue.')
        return
      }
      artist = savedArtist
    }

    setAccountProfile(artist)
    setUser(artist)
    if (authMode === 'signup') {
      const welcomeEmail = {
        id: `welcome-${Date.now()}`,
        recipient: email,
        sender: 'KAIRO Studio',
        subject: 'Welcome to the room 🎧',
        body: `Hey ${name || 'there'}, you’re on the list. New beats, session notes and first access to fresh drops will land here.`,
        createdAt: new Date().toISOString(),
        kind: 'welcome',
      }
      setEmails((current) => [welcomeEmail, ...current])
      notify('You’re in. Welcome to the room.')
    } else {
      notify(`Welcome back, ${artist.name.split(' ')[0]}.`)
    }
    setAuthOpen(false)

    if (pendingBeat) {
      const nextBeat = pendingBeat
      setPendingBeat(null)
      setPaymentMethod('momo')
      setPaymentError('')
      setCheckoutReference(`KAIRO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
      setCheckoutBeat(nextBeat)
    }
  }

  const handlePaymentSubmit = async (event) => {
    event.preventDefault()
    if (!checkoutBeat || !user) return
    const form = event.currentTarget
    const data = new FormData(form)
    const phone = String(data.get('phone') || '').trim()
    const transferReference = String(data.get('transferReference') || '').trim()
    const serverManaged = backendOnline && checkoutBeat.serverManaged
    if (paymentMethod === 'momo' && phone.length < 8) {
      setPaymentError('Enter a valid mobile money number to continue.')
      return
    }
    if (paymentMethod === 'bank' && !serverManaged && transferReference.length < 3) {
      setPaymentError('Add your bank transfer reference to continue.')
      return
    }

    let orderReference = checkoutReference
    let orderStatus = 'Paid · demo'
    if (serverManaged) {
      try {
        const { response, data: result } = await apiRequest('/api/checkout/initialize/', {
          method: 'POST',
          body: {
            beat_id: checkoutBeat.id,
            payment_method: paymentMethod === 'momo' ? 'mobile_money' : 'bank',
            phone,
          },
        })
        if (!response.ok) {
          setPaymentError(result.error || 'The payment could not be started. Please try again.')
          return
        }
        if (result.mode === 'gateway') {
          if (!result.authorization_url) {
            setPaymentError('The payment provider did not return a checkout link.')
            return
          }
          window.location.assign(result.authorization_url)
          return
        }
        orderReference = result.order.id
        orderStatus = result.order.status || 'Demo only'
      } catch {
        setPaymentError('The payment service could not be reached. Please try again.')
        return
      }
    }

    const localDownloadAvailable = !serverManaged && Boolean(checkoutBeat.audioUrl)
    const order = {
      id: orderReference,
      beatId: checkoutBeat.id,
      title: checkoutBeat.title,
      price: checkoutBeat.price,
      email: user.email,
      customer: user.name,
      method: paymentMethod === 'momo' ? `${paymentNetwork} · ${phone}` : `Bank / card · ${transferReference || 'gateway checkout'}`,
      paidAt: new Date().toISOString(),
      status: orderStatus,
    }
    const receipt = {
      id: `receipt-${orderReference}`,
      recipient: user.email,
      sender: 'KAIRO Studio',
      subject: `Your beat order: ${checkoutBeat.title}`,
      body: `Thanks for supporting the music. Your ${checkoutBeat.title} ${serverManaged ? 'demo order' : 'sample order'} is recorded as ${formatPrice(checkoutBeat.price)}. Order ${orderReference}. ${localDownloadAvailable ? 'The uploaded file is available in this browser preview.' : 'A real download email is sent only after a live payment is verified.'}`,
      beatId: checkoutBeat.id,
      orderId: orderReference,
      createdAt: new Date().toISOString(),
      kind: 'receipt',
    }
    setOrders((current) => [order, ...current])
    setEmails((current) => [receipt, ...current])
    setPaymentDone({
      ...order,
      audioUrl: localDownloadAvailable ? checkoutBeat.audioUrl : null,
      audioName: localDownloadAvailable ? checkoutBeat.audioName || null : null,
      remoteVerified: false,
    })
    setCheckoutBeat(null)
    setPaymentError('')
  }

  const handleBeatUpload = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = audioUploadRef.current?.files?.[0]
    if (!file) {
      notify('Choose a master audio file to upload first.')
      return
    }
    if (file.size > 120 * 1024 * 1024) {
      notify('That audio file is too large (120 MB max).')
      return
    }
    const title = String(data.get('title') || '').trim()

    if (backendOnline) {
      if (!user?.is_staff) {
        notify('Sign in as a producer admin at /admin before publishing server files.')
        return
      }
      try {
        const { response, data: result } = await apiRequest('/api/admin/beats/', { method: 'POST', body: data, formData: true })
        if (!response.ok) {
          notify(result.error || 'The beat could not be uploaded.')
          return
        }
        const remoteBeat = { ...result, serverManaged: true }
        setBeats((current) => [remoteBeat, ...current.filter((beat) => beat.serverManaged)])
        form.reset()
        notify(`“${title}” is published to the live catalogue.`)
        setAdminTab('beats')
      } catch {
        notify('The upload service could not be reached. Try again in a moment.')
      }
      return
    }

    const newBeat = {
      id: `beat-${Date.now()}`,
      title,
      genre: String(data.get('genre') || 'Afrobeats'),
      bpm: Number(data.get('bpm') || 100),
      key: String(data.get('musical_key') || 'C minor'),
      price: Number(data.get('price') || 280),
      tag: 'JUST ADDED',
      artwork: `art-upload-${Math.floor(Math.random() * 3) + 1}`,
      coverLine: 'NEW FROM THE STUDIO',
      audioName: file.name,
      audioUrl: URL.createObjectURL(file),
    }
    setBeats((current) => [newBeat, ...current])
    form.reset()
    notify(`“${title}” is live in your beat shop.`)
    setAdminTab('beats')
  }

  const handleVideoUpload = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = videoUploadRef.current?.files?.[0]
    if (!file) {
      notify('Choose a video file to upload first.')
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      notify('That video is too large (200 MB max).')
      return
    }

    if (backendOnline) {
      if (!user?.is_staff) {
        notify('Sign in as a producer admin at /admin before publishing server files.')
        return
      }
      try {
        const { response, data: result } = await apiRequest('/api/admin/videos/', { method: 'POST', body: data, formData: true })
        if (!response.ok) {
          notify(result.error || 'The video could not be uploaded.')
          return
        }
        setVideos((current) => [{ ...result, serverManaged: true }, ...current.filter((video) => video.serverManaged)])
        form.reset()
        notify('Your new visual is live on the studio page.')
        setAdminTab('videos')
      } catch {
        notify('The upload service could not be reached. Try again in a moment.')
      }
      return
    }

    const newVideo = {
      id: `video-${Date.now()}`,
      title: String(data.get('title') || '').trim(),
      detail: String(data.get('detail') || '').trim() || 'A new look inside the studio.',
      duration: 'NEW',
      poster: 'poster-upload',
      fileName: file.name,
      mediaUrl: URL.createObjectURL(file),
    }
    setVideos((current) => [newVideo, ...current])
    form.reset()
    notify('Your new visual is ready to feature.')
    setAdminTab('videos')
  }

  const handleBroadcast = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const subject = String(data.get('subject') || '').trim()
    const body = String(data.get('body') || '').trim()
    if (!subject || !body) return
    if (backendOnline && !user?.is_staff) {
      notify('Sign in as a producer admin at /admin before sending email updates.')
      return
    }
    const message = {
      id: `broadcast-${Date.now()}`,
      recipient: 'all',
      sender: 'KAIRO Studio',
      subject,
      body,
      createdAt: new Date().toISOString(),
      kind: 'update',
    }
    if (backendOnline) {
      try {
        const { response, data: result } = await apiRequest('/api/admin/email-updates/', { method: 'POST', body: { subject, body } })
        if (!response.ok) {
          notify(result.error || 'Email update could not be sent.')
          return
        }
        setEmails((current) => [message, ...current])
        form.reset()
        notify(`Email submitted to ${result.recipients} artist account(s).`)
      } catch {
        notify('The email service could not be reached. Try again in a moment.')
      }
      return
    }
    setEmails((current) => [message, ...current])
    form.reset()
    notify('Message added to the artist inbox preview.')
  }

  const removeBeat = async (beat) => {
    if (backendOnline && beat.serverManaged) {
      if (!user?.is_staff) {
        notify('Sign in as a producer admin at /admin to manage server beats.')
        return
      }
      try {
        const { response, data } = await apiRequest(`/api/admin/beats/${beat.id}/unpublish/`, { method: 'POST', body: {} })
        if (!response.ok) {
          notify(data.error || 'The beat could not be removed.')
          return
        }
      } catch {
        notify('The catalogue service could not be reached.')
        return
      }
    }
    if (beat.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(beat.audioUrl)
    setBeats((current) => current.filter((item) => item.id !== beat.id))
    if (playingBeat?.id === beat.id) {
      setIsPlaying(false)
      setPlayingBeat(null)
    }
    notify('Beat removed from the shop.')
  }

  const removeVideo = async (video) => {
    if (backendOnline && video.serverManaged) {
      if (!user?.is_staff) {
        notify('Sign in as a producer admin at /admin to manage server videos.')
        return
      }
      try {
        const { response, data } = await apiRequest(`/api/admin/videos/${video.id}/unpublish/`, { method: 'POST', body: {} })
        if (!response.ok) {
          notify(data.error || 'The video could not be removed.')
          return
        }
      } catch {
        notify('The video service could not be reached.')
        return
      }
    }
    if (video.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(video.mediaUrl)
    setVideos((current) => current.filter((item) => item.id !== video.id))
    notify('Video removed from the page.')
  }

  const handleSubscribe = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('newsletterEmail') || '').trim().toLowerCase()
    if (email && !subscribers.includes(email)) setSubscribers((current) => [...current, email])
    form.reset()
    notify('You’re on the list. Keep an eye on your inbox.')
  }

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText('000 000 0000')
      notify('Demo account number copied.')
    } catch {
      notify('Demo account number: 000 000 0000')
    }
  }

  const handleLogout = () => {
    setUser(null)
    setAccountOpen(false)
    window.localStorage.removeItem('kairo-session')
    notify('You’ve signed out.')
  }

  const openAuth = (mode = 'signup') => {
    setAuthError('')
    setAuthMode(mode)
    setAuthOpen(true)
    setMobileMenuOpen(false)
  }

  const navLinks = [
    { label: 'Beats', id: 'beats' },
    { label: 'Visuals', id: 'visuals' },
    { label: 'The sound', id: 'about' },
  ]

  return (
    <div className="site-shell">
      <audio ref={audioRef} className="sr-only" onTimeUpdate={(event) => {
        const audio = event.currentTarget
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
      }} onEnded={() => { setIsPlaying(false); setProgress(0) }} />

      <header className="site-header">
        <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); scrollTo('top') }} aria-label="Kairo Beats home">
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span className="brand-type"><strong>KAIRO</strong><small>BEATS & SOUND</small></span>
        </a>
        <nav className={`main-nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {navLinks.map((link) => <button type="button" key={link.id} onClick={() => scrollTo(link.id)}>{link.label}</button>)}
          <button type="button" className="mobile-only-nav" onClick={() => { setAdminOpen(true); setAdminTab('overview'); setMobileMenuOpen(false) }}><Icon name="settings" size={16} /> Producer studio</button>
          {!user && <button type="button" className="mobile-only-nav" onClick={() => openAuth('signup')}><Icon name="user" size={16} /> Artist account</button>}
        </nav>
        <div className="header-actions">
          <button className="studio-link" type="button" onClick={() => { setAdminTab('overview'); setAdminOpen(true) }}><Icon name="settings" size={15} /> <span>Producer studio</span></button>
          {user ? (
            <button type="button" className="account-chip" onClick={() => { setAccountTab('purchases'); setAccountOpen(true) }}>
              <span className="avatar-dot">{user.name?.[0]?.toUpperCase() || 'A'}</span><span className="account-chip-name">My artist desk</span><Icon name="arrowUpRight" size={15} />
            </button>
          ) : (
            <button type="button" className="header-cta" onClick={() => openAuth('signup')}>Join as an artist <Icon name="arrowUpRight" size={15} /></button>
          )}
        </div>
        <button type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileMenuOpen((open) => !open)}>
          <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={21} />
        </button>
      </header>

      <main>
        <section className="hero-section" id="top">
          <div className="hero-photo-wrap" aria-hidden="true">
            <img className="hero-photo" src={heroPhoto} alt="" />
            <div className="hero-photo-tint" />
            <div className="hero-spotlight" />
          </div>
          <div className="hero-grain" aria-hidden="true" />
          <div className="hero-content page-width">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow"><span className="live-dot" /> INDEPENDENT PRODUCER <span className="eyebrow-divider">/</span> ACCRA, GH</div>
              <h1>Good records<br />start with<br /><em>great beats.</em></h1>
              <p className="hero-intro">Original Afrobeats, R&amp;B and alté instrumentals for artists with a story to tell.</p>
              <div className="hero-actions">
                <button className="button button-primary" type="button" onClick={() => scrollTo('beats')}>Find your sound <Icon name="arrowRight" size={17} /></button>
                <button className="button button-quiet" type="button" onClick={() => scrollTo('visuals')}><span className="quiet-play"><Icon name="play" size={11} /></span> Inside the studio</button>
              </div>
              <div className="hero-proof">
                <div className="proof-avatars" aria-hidden="true"><span>K</span><span>♪</span><span>+</span></div>
                <div><strong>Made for the ones making moves.</strong><small>Instant delivery · Artist-friendly licenses</small></div>
              </div>
            </div>

            <div className="hero-overlays">
              <div className="hero-edition"><span>THE KAIRO<br />SOUND SYSTEM</span><b>VOL. 04</b></div>
              <div className="hero-float-card">
                <div className="float-topline"><span><i className="live-dot" /> FEATURED PREVIEW</span><span>01 / 04</span></div>
                <div className="float-track-row">
                  <button className="float-play" type="button" aria-label={playingBeat?.id === beats[0]?.id && isPlaying ? 'Pause preview' : 'Play preview'} onClick={() => beats[0] && toggleTrack(beats[0])}>
                    <Icon name={playingBeat?.id === beats[0]?.id && isPlaying ? 'pause' : 'play'} size={16} />
                  </button>
                  <div className="float-track-info"><strong>{beats[0]?.title || 'New sounds coming soon'}</strong><span>{beats[0]?.genre || 'Kairo original'} · {beats[0]?.bpm || 98} BPM</span></div>
                  <Waveform count={17} className={playingBeat?.id === beats[0]?.id && isPlaying ? 'is-animated' : ''} />
                </div>
              </div>
              <div className="hero-stamp"><span>MAKE<br />SOMETHING<br />THAT MOVES</span><span className="stamp-arrow">↗</span></div>
            </div>
          </div>
          <div className="hero-bottom page-width">
            <div className="hero-scroll"><span className="scroll-line" /> SCROLL TO EXPLORE</div>
            <div className="hero-bottom-note"><span>AFRO-FUTURE, MADE BY HAND</span><span className="bottom-note-line" /><span>BEATS · VISUALS · GOOD ENERGY</span></div>
          </div>
        </section>

        <section className="ticker-band" aria-label="Producer specialties">
          <div className="ticker-track">
            {Array.from({ length: 2 }, (_, run) => (
              <div className="ticker-run" key={run} aria-hidden={run === 1}>
                <span>AFROBEATS</span><b>✳</b><span>R&amp;B</span><b>✳</b><span>ALTÉ</span><b>✳</b><span>AMAPIANO</span><b>✳</b><span>MADE FOR YOUR NEXT</span><b>✳</b>
              </div>
            ))}
          </div>
        </section>

        <section className="beats-section page-width section-pad" id="beats">
          <div className="section-heading beats-heading">
            <div>
              <div className="eyebrow section-eyebrow"><span>01</span> THE BEAT SHOP</div>
              <h2>Find your <em>frequency.</em></h2>
              <p className="section-description">A little soul, a little bounce. Pick a beat, make it yours.</p>
            </div>
            <div className="beat-shop-note"><Icon name="headphones" size={18} /><span>Every purchase includes a<br /><strong>non-exclusive artist license.</strong></span></div>
          </div>

          <div className="shop-toolbar">
            <div className="category-filter" role="group" aria-label="Filter beats by genre">
              {availableCategories.map((item) => <button type="button" key={item} className={`filter-chip ${category === item ? 'is-active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <label className="search-box"><Icon name="search" size={17} /><input ref={searchInputRef} type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search beats" aria-label="Search beats" /><kbd>⌘ K</kbd></label>
          </div>

          {visibleBeats.length ? (
            <div className="beat-grid">
              {visibleBeats.map((beat, index) => {
                const currentlyPlaying = playingBeat?.id === beat.id && isPlaying
                return (
                  <article className="beat-card" key={beat.id} style={{ '--card-index': index }}>
                    <div className="beat-card-art-wrap">
                      <BeatArtwork beat={beat} playing={currentlyPlaying} onPlay={() => toggleTrack(beat)} />
                      {beat.tag && <span className="beat-tag">{beat.tag}</span>}
                      {(beat.serverManaged ? beat.hasAudio : beat.audioName) && <span className="uploaded-file-tag"><Icon name="check" size={11} /> AUDIO READY</span>}
                    </div>
                    <div className="beat-card-info">
                      <div className="beat-title-row"><div><span className="beat-genre">{beat.genre}</span><h3>{beat.title}</h3></div><strong className="beat-price">{formatPrice(beat.price)}</strong></div>
                      <div className="beat-meta"><span>{beat.bpm} BPM</span><i /> <span>{beat.key}</span><i /> <span>ARTIST LICENSE</span></div>
                      <div className="beat-card-actions">
                        <button type="button" className="beat-preview-button" onClick={() => toggleTrack(beat)}><Icon name={currentlyPlaying ? 'pause' : 'play'} size={14} /> {currentlyPlaying ? 'Playing preview' : beat.audioUrl ? 'Preview beat' : 'No preview yet'}</button>
                        <button type="button" className="beat-buy-button" onClick={() => openPurchase(beat)} aria-label={`Buy ${beat.title} for ${formatPrice(beat.price)}`}>License beat <Icon name="arrowUpRight" size={15} /></button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-results"><Icon name="search" size={23} /><strong>No beats found just yet.</strong><span>Try another title or switch up the genre.</span><button type="button" onClick={() => { setSearchTerm(''); setCategory('All beats') }}>Clear filters</button></div>
          )}
          <div className="license-strip"><div className="license-icon"><Icon name="lock" size={17} /></div><div><strong>Clear terms. No surprises.</strong><span>Every license includes commercial use and streaming rights, with an email-ready download flow.</span></div><button type="button" onClick={() => notify('Licenses include commercial use and streaming. Exclusive rights can be arranged by email.')}>See how licensing works <Icon name="arrowRight" size={15} /></button></div>
        </section>

        <section className="visuals-section" id="visuals">
          <div className="page-width visuals-inner section-pad">
            <div className="section-heading visuals-heading">
              <div>
                <div className="eyebrow section-eyebrow"><span>02</span> BEHIND THE SOUND</div>
                <h2>More than a <em>loop.</em></h2>
                <p className="section-description">The late nights, happy accidents and little details behind the records.</p>
              </div>
              <button type="button" className="text-link" onClick={() => { setAdminTab('videos'); setAdminOpen(true) }}>Explore the studio <Icon name="arrowUpRight" size={16} /></button>
            </div>
            <div className="visual-grid">
              {videos.slice(0, 3).map((video, index) => (
                <button type="button" className={`visual-card ${index === 0 ? 'visual-feature' : ''} ${video.poster || 'poster-process'}`} key={video.id} onClick={() => setActiveVideo(video)}>
                  {index === 0 && !video.mediaUrl && <img className="visual-poster-image" src={heroPhoto} alt="Kairo working in his recording studio" />}
                  {video.mediaUrl && <video className="visual-poster-video" src={video.mediaUrl} muted playsInline preload="metadata" />}
                  <span className="visual-card-shade" />
                  <span className="visual-play"><Icon name="play" size={17} /></span>
                  <span className="visual-card-footer"><span><small>{video.mediaUrl ? 'NEW VISUAL' : 'FROM THE STUDIO'}</small><strong>{video.title}</strong></span><span className="visual-duration">{video.duration || 'NEW'}</span></span>
                  {index === 0 && <span className="visual-feature-note">PROCESS<br />OVER POLISH</span>}
                </button>
              ))}
              {videos.length === 0 && <div className="visual-empty"><Icon name="video" size={22} /><span>No studio videos yet.</span><button type="button" onClick={() => { setAdminTab('videos'); setAdminOpen(true) }}>Add the first one <Icon name="arrowRight" size={14} /></button></div>}
            </div>
          </div>
        </section>

        <section className="manifesto-section page-width section-pad" id="about">
          <div className="manifesto-mark"><span className="brand-mark large"><i /><i /><i /><i /></span><span>INDEPENDENT BY NATURE</span></div>
          <div className="manifesto-copy"><div className="eyebrow section-eyebrow"><span>03</span> THE KAIRO APPROACH</div><h2>Made with feeling.<br /><em>Finished with intention.</em></h2><p>Good music starts with a feeling you can’t quite explain. I make the space, find the sound, and leave room for your story to happen.</p><a className="manifesto-link" href="mailto:hello@kairobeats.studio">Let’s make something <Icon name="arrowUpRight" size={15} /></a></div>
          <div className="manifesto-side"><span className="side-label">A NOTE FROM THE STUDIO</span><p>“The beat is only the beginning. The magic is what you bring to it.”</p><span className="signature">— Kairo</span></div>
        </section>

        <section className="newsletter-section">
          <div className="newsletter-inner page-width">
            <div className="newsletter-copy"><span className="eyebrow"><span className="live-dot" /> NOTES FROM THE STUDIO</span><h2>Fresh sounds.<br /><em>First access.</em></h2><p>New drops, little stories and first dibs on the good stuff. No noise.</p></div>
            <form className="newsletter-form" onSubmit={handleSubscribe}><label htmlFor="newsletter-email">Your email address</label><div className="newsletter-input-row"><input id="newsletter-email" name="newsletterEmail" type="email" placeholder="you@yourmail.com" required /><button type="submit" aria-label="Join the mailing list"><Icon name="arrowRight" size={19} /></button></div><small>By joining, you agree to get occasional notes from Kairo. Unsubscribe whenever.</small></form>
            <div className="newsletter-art" aria-hidden="true"><div className="newsletter-disc"><span /><i /><i /><i /><i /><i /><i /><i /></div><span className="newsletter-label">SIDE A<br />YOUR NEXT<br />FAVOURITE</span></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-width footer-main"><a className="brand footer-brand" href="#top" onClick={(event) => { event.preventDefault(); scrollTo('top') }}><span className="brand-mark"><i /><i /><i /><i /></span><span className="brand-type"><strong>KAIRO</strong><small>BEATS & SOUND</small></span></a><p>Independent sound for artists<br />building something real.</p><div className="footer-links"><button type="button" onClick={() => scrollTo('beats')}>Beat shop</button><button type="button" onClick={() => scrollTo('visuals')}>Studio visuals</button><button type="button" onClick={() => { setAdminTab('overview'); setAdminOpen(true) }}>Producer admin</button><a href="mailto:hello@kairobeats.studio">Get in touch <Icon name="arrowUpRight" size={13} /></a></div><a className="footer-backtop" href="#top" onClick={(event) => { event.preventDefault(); scrollTo('top') }}>BACK TO TOP <span>↑</span></a></div>
        <div className="page-width footer-bottom"><span>© 2026 KAIRO BEATS · ACCRA, GHANA</span><span>MADE WITH INTENTION <i>✳</i></span><span className="preview-footnote">{backendOnline ? 'Django-backed · checkout and email depend on server configuration' : 'Local browser preview · no real payments or emails'}</span></div>
      </footer>

      {playingBeat && (
        <div className="mini-player" role="region" aria-label="Beat preview player">
          <BeatArtwork beat={playingBeat} compact onPlay={() => setIsPlaying((current) => !current)} playing={isPlaying} />
          <div className="mini-track"><div className="mini-track-names"><strong>{playingBeat.title}</strong><span>{playingBeat.genre} · {playingBeat.bpm} BPM</span></div><div className="mini-progress"><span style={{ width: `${progress}%` }} /></div></div>
          <button type="button" className="mini-play" aria-label={isPlaying ? 'Pause preview' : 'Play preview'} onClick={() => setIsPlaying((current) => !current)}><Icon name={isPlaying ? 'pause' : 'play'} size={16} /></button>
          <Waveform count={22} className={isPlaying ? 'is-animated' : ''} />
          <button type="button" className="mini-close" aria-label="Close player" onClick={() => { setIsPlaying(false); setPlayingBeat(null); setProgress(0) }}><Icon name="close" size={18} /></button>
        </div>
      )}

      {authOpen && (
        <Dialog onClose={() => { setAuthOpen(false); setPendingBeat(null) }} className="auth-dialog" label={authMode === 'signup' ? 'Create artist account' : 'Artist sign in'}>
          <button className="dialog-close" type="button" onClick={() => { setAuthOpen(false); setPendingBeat(null) }} aria-label="Close"><Icon name="close" /></button>
          <div className="auth-brand"><span className="brand-mark"><i /><i /><i /><i /></span><span className="brand-type"><strong>KAIRO</strong><small>BEATS & SOUND</small></span></div>
          <span className="eyebrow modal-eyebrow"><span className="live-dot" /> YOUR ARTIST PASS</span>
          <h2>{authMode === 'signup' ? 'Come on in.' : 'Good to have you back.'}</h2>
          <p className="dialog-intro">{authMode === 'signup' ? 'Create an account to collect beats, keep your receipts and get new drops in your inbox.' : 'Sign in to get back to your beats, downloads and studio notes.'}</p>
          <div className="auth-switch"><button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setAuthError('') }}>Create account</button><button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setAuthError('') }}>Sign in</button></div>
          <form className="dialog-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && <label>Your name<input name="name" type="text" autoComplete="name" placeholder="What should we call you?" required minLength={2} /></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@yourmail.com" required /></label>
            <label>Password<input name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} placeholder={authMode === 'signup' ? 'At least 10 characters' : 'Your password'} required minLength={authMode === 'signup' ? 10 : 1} /></label>
            {authError && <p className="form-error">{authError}</p>}
            <p className="demo-note"><Icon name="lock" size={14} /> {backendOnline ? 'Your password is verified and securely hashed by Django.' : 'Local preview only: the password is discarded, and sign-in is not secure.'}</p>
            <button className="button button-primary full-width" type="submit">{authMode === 'signup' ? 'Create my artist account' : 'Sign in to my desk'} <Icon name="arrowRight" size={16} /></button>
          </form>
          <p className="auth-footnote">By continuing, you agree to keep the music moving and your email for studio notes only.</p>
        </Dialog>
      )}

      {checkoutBeat && (
        <Dialog onClose={() => setCheckoutBeat(null)} className="checkout-dialog" label={`Purchase ${checkoutBeat.title}`}>
          <button className="dialog-close" type="button" onClick={() => setCheckoutBeat(null)} aria-label="Close"><Icon name="close" /></button>
          <div className="checkout-kicker"><span className="eyebrow"><Icon name="lock" size={13} /> {paystackLiveForSelectedBeat ? 'PAYSTACK SECURE CHECKOUT' : 'CHECKOUT PREVIEW'}</span><span className="checkout-step">01 <i /> 02</span></div>
          <h2>Make it <em>yours.</em></h2>
          <div className="checkout-item"><BeatArtwork beat={checkoutBeat} compact /><div><span>{checkoutBeat.genre} · {checkoutBeat.bpm} BPM</span><strong>{checkoutBeat.title}</strong><small>Artist license · instant download</small></div><b>{formatPrice(checkoutBeat.price)}</b></div>
          <div className="checkout-total"><span>Total</span><strong>{formatPrice(checkoutBeat.price)}</strong></div>
          <div className="payment-choices" role="group" aria-label="Choose a payment method">
            <button type="button" className={paymentMethod === 'momo' ? 'selected' : ''} onClick={() => { setPaymentMethod('momo'); setPaymentError('') }}><span className="payment-choice-icon"><Icon name="phone" size={17} /></span><span><strong>Mobile money</strong><small>MTN · Telecel · AT</small></span>{paymentMethod === 'momo' && <Icon name="check" size={16} />}</button>
            <button type="button" className={paymentMethod === 'bank' ? 'selected' : ''} onClick={() => { setPaymentMethod('bank'); setPaymentError('') }}><span className="payment-choice-icon"><Icon name="bank" size={17} /></span><span><strong>{paystackLiveForSelectedBeat ? 'Bank / card' : 'Bank transfer'}</strong><small>{paystackLiveForSelectedBeat ? 'Secure gateway checkout' : 'Demo account details'}</small></span>{paymentMethod === 'bank' && <Icon name="check" size={16} />}</button>
          </div>
          <form className="dialog-form checkout-form" onSubmit={handlePaymentSubmit}>
            {paymentMethod === 'momo' ? (
              <>
                <label>Mobile money network<select value={paymentNetwork} onChange={(event) => setPaymentNetwork(event.target.value)}><option>MTN Mobile Money</option><option>Telecel Cash</option><option>AT Money</option></select></label>
                <label>Mobile money number<input name="phone" type="tel" autoComplete="tel" placeholder="e.g. 024 000 0000" required /></label>
                <p className="payment-instruction">{paystackLiveForSelectedBeat ? 'You’ll approve this charge in Paystack’s secure mobile-money flow.' : 'Demo only: no mobile-money prompt will be sent and no funds will move.'}</p>
              </>
            ) : (
              <>
                {paystackLiveForSelectedBeat ? <div className="bank-details provider-info"><div><small>PAYSTACK CHECKOUT</small><strong>Bank or card payment</strong><span>Choose from the methods enabled on the producer’s Paystack account.</span></div><p>Your order is marked paid only after the provider verifies the transaction.</p></div> : <>
                  <div className="bank-details"><div><small>DEMO BANK ACCOUNT</small><strong>KAIRO SOUND STUDIO</strong><span>Demo Bank · Current account</span></div><div className="bank-number"><span>000 000 0000</span><button type="button" onClick={copyAccountNumber}>Copy</button></div></div>
                  <label>Transfer reference<input name="transferReference" type="text" placeholder={checkoutReference} required /></label>
                  <p className="payment-instruction">Use your order reference <strong>{checkoutReference}</strong> when sending a transfer.</p>
                </>}
              </>
            )}
            {paymentError && <p className="form-error">{paymentError}</p>}
            {paystackLiveForSelectedBeat ? <div className="demo-payment-alert live-payment-alert"><Icon name="lock" size={15} /><span><strong>Live gateway enabled.</strong> You’ll continue to Paystack. KAIRO receives confirmation only after server-side verification.</span></div> : <div className="demo-payment-alert"><Icon name="spark" size={15} /><span><strong>Demo checkout.</strong> No real payment is taken or verified. This records a clearly marked demo order.</span></div>}
            <button className="button button-primary full-width" type="submit">{paystackLiveForSelectedBeat ? 'Continue to secure checkout' : 'Complete demo purchase'} <Icon name="arrowRight" size={16} /></button>
          </form>
          <p className="checkout-email-note"><Icon name="mail" size={14} /> {paystackLiveForSelectedBeat ? 'Verified purchases trigger a receipt and a private, expiring download link by email.' : 'Demo receipts stay in this preview; no real email is sent.'}</p>
        </Dialog>
      )}

      {paymentDone && (
        <Dialog onClose={() => setPaymentDone(null)} className="success-dialog" label="Purchase complete">
          <button className="dialog-close" type="button" onClick={() => setPaymentDone(null)} aria-label="Close"><Icon name="close" /></button>
          <div className="success-symbol"><Icon name="check" size={29} /></div>
          <span className="eyebrow modal-eyebrow">ORDER {paymentDone.id}</span>
          <h2>That’s a <em>good sound.</em></h2>
          <p className="dialog-intro">{paymentDone.remoteVerified ? <>Payment verified for <strong>{paymentDone.title}</strong>. Your secure download is ready. {paymentDone.emailSent ? <>The receipt was emailed to <strong>{paymentDone.email}</strong>.</> : <>Email delivery needs attention for <strong>{paymentDone.email}</strong>.</>}</> : <>Your demo order for <strong>{paymentDone.title}</strong> is saved. A receipt preview is waiting in your artist desk at <strong>{paymentDone.email}</strong>.</>}</p>
          {paymentDone.audioUrl ? <a className="button button-primary full-width download-success" href={paymentDone.audioUrl} download={paymentDone.audioName || `${paymentDone.title.replaceAll(' ', '-')}.mp3`}><Icon name="download" size={16} /> Download your beat</a> : <div className="download-unavailable"><Icon name="music" size={16} /><span>Sample listing only — the producer hasn’t attached a downloadable audio file yet.</span></div>}
          <button className="success-secondary" type="button" onClick={() => { setPaymentDone(null); setAccountTab('inbox'); setAccountOpen(true) }}>Open my artist inbox <Icon name="arrowRight" size={15} /></button>
          <p className="success-demo-note">{paymentDone.remoteVerified ? (paymentDone.emailSent ? 'Payment verified by Paystack · the receipt email was accepted for delivery.' : 'Payment verified by Paystack · secure download is ready. Email delivery may need attention.') : 'Demo only · no money was moved and no external email was sent.'}</p>
        </Dialog>
      )}

      {accountOpen && user && (
        <Dialog onClose={() => setAccountOpen(false)} wide className="account-dialog" label="Artist account desk">
          <div className="workspace-header"><div><span className="eyebrow"><span className="live-dot" /> ARTIST DESK</span><h2>Your room, {user.name.split(' ')[0]}.</h2><p>{user.email}</p></div><button className="dialog-close inline-close" type="button" onClick={() => setAccountOpen(false)} aria-label="Close"><Icon name="close" /></button></div>
          <div className="workspace-tabs"><button type="button" className={accountTab === 'purchases' ? 'active' : ''} onClick={() => setAccountTab('purchases')}><Icon name="music" size={15} /> My purchases <span>{myOrders.length}</span></button><button type="button" className={accountTab === 'inbox' ? 'active' : ''} onClick={() => setAccountTab('inbox')}><Icon name="mail" size={15} /> Email inbox <span>{myEmails.length}</span></button></div>
          {accountTab === 'purchases' ? (
            <div className="account-content">
              {myOrders.length ? <div className="purchase-list">{myOrders.map((order) => {
                const currentBeat = beats.find((beat) => beat.id === order.beatId)
                const downloadUrl = order.downloadUrl || (!currentBeat?.serverManaged ? currentBeat?.audioUrl : '')
                return <article className="purchase-row" key={order.id}><BeatArtwork beat={currentBeat || { ...order, artwork: 'art-upload-1', coverLine: 'KAIRO LICENSE' }} compact /><div className="purchase-row-info"><strong>{order.title}</strong><span>{shortDate(order.paidAt)} · {order.id}</span></div><div className="purchase-row-price"><b>{formatPrice(order.price)}</b><span>{order.status}</span></div>{downloadUrl ? <a className="small-icon-action" href={downloadUrl} download={order.downloadUrl ? undefined : (currentBeat?.audioName || `${order.title.replaceAll(' ', '-')}.mp3`)} aria-label={`Download ${order.title}`}><Icon name="download" size={16} /></a> : <span className="purchase-pending" title="Secure download becomes available after a verified payment"><Icon name="check" size={15} /></span>}</article>
              })}</div> : <div className="workspace-empty"><div className="empty-icon"><Icon name="headphones" size={22} /></div><h3>Your next record starts here.</h3><p>When you license a beat, it’ll be ready to find right here.</p><button className="button button-primary" type="button" onClick={() => { setAccountOpen(false); scrollTo('beats') }}>Browse the beat shop <Icon name="arrowRight" size={15} /></button></div>}
            </div>
          ) : (
            <div className="inbox-list">{myEmails.length ? myEmails.map((email) => <article className="email-row" key={email.id}><div className={`email-icon ${email.kind === 'receipt' ? 'receipt' : ''}`}><Icon name={email.kind === 'receipt' ? 'music' : 'mail'} size={17} /></div><div className="email-row-main"><div className="email-row-top"><strong>{email.subject}</strong><span>{shortDate(email.createdAt)}</span></div><span className="email-sender">From {email.sender} · To {email.recipient === 'all' ? user.email : email.recipient}</span><p>{email.body}</p>{email.kind === 'receipt' && (() => { const orderedBeat = beats.find((beat) => beat.id === email.beatId); const fileUrl = email.downloadUrl || (!orderedBeat?.serverManaged ? orderedBeat?.audioUrl : ''); return fileUrl ? <a className="email-download" href={fileUrl} download={email.downloadUrl ? undefined : (orderedBeat?.audioName || `${orderedBeat?.title.replaceAll(' ', '-')}.mp3`)}><Icon name="download" size={14} /> Download {orderedBeat?.title || 'beat'}</a> : null })()}</div></article>) : <div className="workspace-empty compact-empty"><div className="empty-icon"><Icon name="mail" size={22} /></div><h3>All quiet in here.</h3><p>Studio notes and purchase receipts will land in this inbox.</p></div>}</div>
          )}
          <div className="account-footer"><span><Icon name="lock" size={13} /> Your artist desk is stored locally in this preview.</span><button type="button" onClick={handleLogout}>Sign out</button></div>
        </Dialog>
      )}

      {adminOpen && (
        <Dialog onClose={() => setAdminOpen(false)} wide className="admin-dialog" label="Producer studio dashboard">
          <div className="admin-topbar"><div className="admin-title"><span className="admin-icon"><Icon name="settings" size={18} /></span><div><span className="eyebrow">KAIRO · PRODUCER CONSOLE</span><h2>Studio desk</h2></div></div><div className="admin-top-actions">{backendOnline && <a className="django-admin-link" href="/admin/" target="_blank" rel="noreferrer">Django admin <Icon name="arrowUpRight" size={13} /></a>}<span className="preview-badge"><i /> {backendOnline ? 'SERVER CONNECTED' : 'PREVIEW MODE'}</span><button className="dialog-close inline-close" type="button" onClick={() => setAdminOpen(false)} aria-label="Close"><Icon name="close" /></button></div></div>
          <div className="admin-layout">
            <aside className="admin-sidebar"><span className="sidebar-label">WORKSPACE</span>{[
              ['overview', 'Overview', 'spark'], ['beats', 'Beat shop', 'music'], ['videos', 'Videos', 'video'], ['email', 'Email updates', 'mail'], ['orders', 'Orders', 'bank'],
            ].map(([id, label, icon]) => <button type="button" key={id} className={adminTab === id ? 'active' : ''} onClick={() => setAdminTab(id)}><Icon name={icon} size={16} />{label}{id === 'orders' && orders.length > 0 && <span className="sidebar-count">{orders.length}</span>}</button>)}<div className="sidebar-footer"><span className="admin-online-dot" />Changes are saved in this browser</div></aside>
            <div className="admin-main">
              {adminTab === 'overview' && <div className="admin-pane"><div className="admin-pane-heading"><div><span className="eyebrow">YOUR STUDIO AT A GLANCE</span><h3>Good things are growing.</h3></div><button className="button button-primary button-small" type="button" onClick={() => setAdminTab('beats')}><Icon name="plus" size={15} /> Upload a beat</button></div><div className="stat-grid"><div className="stat-card"><span>BEATS IN THE SHOP</span><strong>{beats.length.toString().padStart(2, '0')}</strong><small><Icon name="music" size={13} /> ready for artists</small></div><div className="stat-card"><span>STUDIO VISUALS</span><strong>{videos.length.toString().padStart(2, '0')}</strong><small><Icon name="video" size={13} /> behind the scenes</small></div><div className="stat-card"><span>DEMO ORDERS</span><strong>{orders.length.toString().padStart(2, '0')}</strong><small><Icon name="bank" size={13} /> local preview only</small></div></div><div className="overview-bottom"><div className="overview-recent"><div className="admin-list-heading"><strong>Recently added</strong><button type="button" onClick={() => setAdminTab('beats')}>View shop <Icon name="arrowRight" size={14} /></button></div>{beats.slice(0, 4).map((beat) => <div className="admin-recent-row" key={beat.id}><BeatArtwork beat={beat} compact /><div><strong>{beat.title}</strong><span>{beat.genre} · {beat.bpm} BPM</span></div><b>{formatPrice(beat.price)}</b></div>)}</div><div className="admin-tip"><span className="tip-icon"><Icon name="spark" size={17} /></span><span className="eyebrow">A QUICK NOTE</span><strong>Good metadata makes a good first impression.</strong><p>Add the tempo, key and a clean preview so the right artist can hear the right record.</p><button type="button" onClick={() => setAdminTab('beats')}>Add a new beat <Icon name="arrowRight" size={14} /></button></div></div>{backendOnline ? <div className="admin-demo-warning"><Icon name="spark" size={15} /><span>Django is connected: accounts, beats, videos and orders persist. Confirm Paystack, SMTP and secure media storage before launch. <a href="/admin/" target="_blank" rel="noreferrer">Open Django admin ↗</a></span></div> : <div className="admin-demo-warning"><Icon name="spark" size={15} /><span>Browser-only preview. Uploaded files stay in this session. Start the Django service for secure accounts, persistent media, verified checkout and real email.</span></div>}</div>}

              {adminTab === 'beats' && <div className="admin-pane"><div className="admin-pane-heading"><div><span className="eyebrow">CATALOGUE MANAGEMENT</span><h3>Put a new beat out there.</h3><p>Upload an audio preview and set the artist license price.</p></div></div><div className="admin-columns"><form className="admin-form-card" onSubmit={handleBeatUpload}><h4><Icon name="upload" size={17} /> Beat details</h4><label>Beat title<input name="title" type="text" placeholder="e.g. City lights in June" required minLength={2} /></label><div className="admin-form-row"><label>Genre<select name="genre" defaultValue="Afrobeats"><option>Afrobeats</option><option>R&amp;B / Alté</option><option>Amapiano</option><option>Drill</option><option>Hip-hop</option><option>Gospel</option></select></label><label>Price (GH₵)<input name="price" type="number" min="1" defaultValue="280" required /></label></div><div className="admin-form-row"><label>Tempo (BPM)<input name="bpm" type="number" min="40" max="240" defaultValue="100" required /></label><label>Musical key<input name="musical_key" type="text" placeholder="e.g. C minor" defaultValue="C minor" required /></label></div><label className="file-drop"><input ref={audioUploadRef} name="audio_file" type="file" accept="audio/*,.mp3,.wav,.aiff,.flac,.m4a" required /><span className="file-drop-icon"><Icon name="upload" size={19} /></span><span><strong>Choose the downloadable master</strong><small>MP3, WAV or AIFF · up to 120 MB · private</small></span><Icon name="arrowUpRight" size={15} /></label><label className="file-drop"><input ref={previewUploadRef} name="preview_file" type="file" accept="audio/*,.mp3,.wav,.aiff,.flac,.m4a" /><span className="file-drop-icon"><Icon name="headphones" size={18} /></span><span><strong>Optional preview clip</strong><small>Public listening sample · up to 30 MB</small></span><Icon name="arrowUpRight" size={15} /></label><button className="button button-primary full-width" type="submit">Publish beat to shop <Icon name="arrowRight" size={15} /></button><p className="form-footnote">{backendOnline ? (user?.is_staff ? 'Files are stored on the Django server. Use private cloud storage for production.' : 'Sign in as a producer admin using the Django admin link above to publish server files.') : 'This browser-only preview keeps uploaded audio in memory until refresh.'}</p></form><div className="admin-list-card"><div className="admin-list-heading"><div><strong>Live in the shop</strong><span>{beats.length} beats</span></div></div>{beats.length ? beats.map((beat) => <div className="manage-row" key={beat.id}><BeatArtwork beat={beat} compact /><div className="manage-row-copy"><strong>{beat.title}</strong><span>{beat.genre} · {beat.bpm} BPM</span></div><button type="button" className="remove-button" onClick={() => removeBeat(beat)} aria-label={`Remove ${beat.title}`}><Icon name="close" size={16} /></button></div>) : <p className="admin-list-empty">Your catalogue is ready for its first beat.</p>}</div></div></div>}

              {adminTab === 'videos' && <div className="admin-pane"><div className="admin-pane-heading"><div><span className="eyebrow">VISUAL STORYTELLING</span><h3>Show them how it sounds.</h3><p>Drop a session clip, a performance or a little moment from the studio.</p></div></div><div className="admin-columns"><form className="admin-form-card" onSubmit={handleVideoUpload}><h4><Icon name="video" size={17} /> New studio visual</h4><label>Video title<input name="title" type="text" placeholder="e.g. Behind the beat: Night Shift" required minLength={2} /></label><label>Short description<textarea name="detail" rows="3" placeholder="What’s the story behind this one?" /></label><label className="file-drop"><input ref={videoUploadRef} name="video_file" type="file" accept="video/*,.mp4,.mov,.webm" required /><span className="file-drop-icon"><Icon name="upload" size={19} /></span><span><strong>Choose a video file</strong><small>MP4, WebM or MOV · up to 200 MB</small></span><Icon name="arrowUpRight" size={15} /></label><button className="button button-primary full-width" type="submit">Add video to page <Icon name="arrowRight" size={15} /></button><p className="form-footnote">{backendOnline ? (user?.is_staff ? 'Video is stored by Django. Use a media CDN or object storage in production.' : 'Sign in as a producer admin using the Django admin link above to publish server files.') : 'Videos are available in this browser session only.'}</p></form><div className="admin-list-card"><div className="admin-list-heading"><div><strong>Featured visuals</strong><span>{videos.length} videos</span></div></div>{videos.length ? videos.map((video) => <div className="manage-row video-manage-row" key={video.id}><span className={`video-mini-poster ${video.poster || 'poster-process'}`}>{video.mediaUrl ? <Icon name="play" size={13} /> : <Icon name="video" size={14} />}</span><div className="manage-row-copy"><strong>{video.title}</strong><span>{video.fileName || 'Studio story'} · {video.duration || 'NEW'}</span></div><button type="button" className="remove-button" onClick={() => removeVideo(video)} aria-label={`Remove ${video.title}`}><Icon name="close" size={16} /></button></div>) : <p className="admin-list-empty">No video moments here yet.</p>}</div></div></div>}

              {adminTab === 'email' && <div className="admin-pane email-admin-pane"><div className="admin-pane-heading"><div><span className="eyebrow">A DIRECT LINE TO YOUR PEOPLE</span><h3>Send a studio note.</h3><p>Share a new drop, a release date or a little hello with artists.</p></div></div><div className="email-composer-layout"><form className="admin-form-card email-composer" onSubmit={handleBroadcast}><div className="composer-to"><div className="email-icon"><Icon name="user" size={17} /></div><span><small>RECIPIENTS</small><strong>Artist community</strong></span><span className="recipient-count">{accountProfile ? '1 artist' : 'your artists'}</span></div><label>Subject line<input name="subject" type="text" placeholder="Something good is coming..." required maxLength={90} /></label><label>Your message<textarea name="body" rows="7" placeholder="Write from the studio..." required maxLength={1200} /></label><div className="demo-email-warning"><Icon name="mail" size={15} /><span>{backendOnline ? 'Connected mode sends via configured SMTP. Without SMTP credentials, messages are printed to the Django console.' : 'Local preview only: this adds a message to the artist inbox preview, but does not send a real email.'}</span></div><button className="button button-primary full-width" type="submit"><Icon name="send" size={15} /> {backendOnline ? 'Send studio email' : 'Save email preview'}</button></form><div className="email-preview-card"><div className="email-preview-top"><span>INBOX PREVIEW</span><Icon name="dots" size={18} /></div><div className="email-preview-mark"><span className="brand-mark"><i /><i /><i /><i /></span></div><small>FROM THE STUDIO</small><h4>Your next favourite might be one email away.</h4><p>New beats, notes from the room and first dibs on the latest drops — only when there’s something worth sharing.</p><div className="email-preview-signature">KAIRO <span>BEATS &amp; SOUND</span></div></div></div></div>}

              {adminTab === 'orders' && <div className="admin-pane"><div className="admin-pane-heading"><div><span className="eyebrow">CHECKOUT ACTIVITY</span><h3>Orders from this preview.</h3><p>Order records are stored on this device and aren’t verified transactions.</p></div></div>{orders.length ? <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>ORDER</th><th>ARTIST</th><th>BEAT</th><th>METHOD</th><th>TOTAL</th><th>DATE</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small>{order.status}</small></td><td>{order.customer}<small>{order.email}</small></td><td>{order.title}</td><td>{order.method}</td><td><strong>{formatPrice(order.price)}</strong></td><td>{shortDate(order.paidAt)}</td></tr>)}</tbody></table></div> : <div className="workspace-empty compact-empty"><div className="empty-icon"><Icon name="bank" size={21} /></div><h3>No orders yet.</h3><p>Demo checkouts will show up here for the producer.</p></div>}<div className="admin-demo-warning"><Icon name="spark" size={15} /><span>Real payment confirmation must come from your payment provider’s verified webhook—not from a button on the storefront.</span></div></div>}
            </div>
          </div>
        </Dialog>
      )}

      {activeVideo && (
        <Dialog onClose={() => setActiveVideo(null)} className="video-dialog" label={activeVideo.title}>
          <button className="dialog-close" type="button" onClick={() => setActiveVideo(null)} aria-label="Close"><Icon name="close" /></button>
          {activeVideo.mediaUrl ? <video className="video-modal-player" src={activeVideo.mediaUrl} controls autoPlay playsInline /> : <div className={`video-modal-poster ${activeVideo.poster || ''}`}><img src={heroPhoto} alt="Inside the Kairo recording studio" /><span className="video-modal-play"><Icon name="play" size={23} /></span><span className="video-modal-caption">KAIRO · BEHIND THE SOUND</span></div>}
          <div className="video-modal-info"><span className="eyebrow">{activeVideo.mediaUrl || activeVideo.videoUrl ? 'JUST ADDED TO THE STUDIO' : 'FROM THE STUDIO ARCHIVE'}</span><h2>{activeVideo.title}</h2><p>{activeVideo.detail}</p>{activeVideo.videoUrl && <a className="external-video-link" href={activeVideo.videoUrl} target="_blank" rel="noreferrer">Watch hosted video <Icon name="arrowUpRight" size={14} /></a>}{!activeVideo.mediaUrl && !activeVideo.videoUrl && <small>Demo visual · Upload a video in Producer Studio to add a playable clip.</small>}</div>
        </Dialog>
      )}

      {toast && <div className="toast-message" role="status"><span className="toast-check"><Icon name="check" size={15} /></span>{toast}<button type="button" onClick={() => setToast('')} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
    </div>
  )
}

export default App

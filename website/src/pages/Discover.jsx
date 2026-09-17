import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { MatchModal } from '../components/MatchModal'
import { ProfileCard } from '../components/ProfileCard'
import { ReportDialog } from '../components/ReportDialog'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHead } from '../components/ui/Card'
import { Chip, ChipGroup } from '../components/ui/Chip'
import { Field, Select, TextInput } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import { useCatalogue } from '../hooks/useCatalogue'
import { useToast } from '../hooks/useToast'
import { api } from '../lib/api'
import { labelFor } from '../lib/format'

const EMPTY_FILTERS = {
  genders: [],
  minAge: 18,
  maxAge: 99,
  interests: [],
  goal: '',
  location: '',
  q: '',
}

/**
 * Module 2 home: the swipe deck plus a filterable search grid.
 * Likes and passes go straight to the API; a mutual like opens the match
 * celebration and the card leaves the deck.
 */
export function Discover() {
  const { user, profileComplete } = useAuth()
  const toast = useToast()
  const { interests: catalogueInterests, genders, relationshipGoals } = useCatalogue()

  const [mode, setMode] = useState('deck')
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [deckState, setDeckState] = useState('loading')

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [results, setResults] = useState([])
  const [searchState, setSearchState] = useState('idle')

  const [viewing, setViewing] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [blocking, setBlocking] = useState(null)
  const [match, setMatch] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadDeck = useCallback(async () => {
    setDeckState('loading')
    try {
      const data = await api.discover.deck(12)
      setQueue(data.items)
      setIndex(0)
      setDeckState(data.items.length ? 'ready' : 'empty')
    } catch {
      setDeckState('error')
    }
  }, [])

  useEffect(() => {
    if (profileComplete) loadDeck()
  }, [profileComplete, loadDeck])

  const card = mode === 'deck' ? (queue[index] ?? null) : null

  async function decide(target, decision) {
    if (busy) return
    setBusy(true)
    try {
      const result = await api.swipes.create({ targetId: target.id, decision })
      if (decision === 'LIKE' && result.matched) {
        setMatch({ matchId: result.match.id, partner: target, me: user })
      }
      if (mode === 'deck') {
        setIndex((current) => current + 1)
      } else {
        setResults((current) => current.filter((item) => item.id !== target.id))
      }
      if (viewing?.id === target.id) setViewing(null)
    } catch (cause) {
      toast.error(cause?.message || 'Could not save your decision.')
    } finally {
      setBusy(false)
    }
  }

  async function runSearch() {
    setSearchState('loading')
    try {
      const data = await api.discover.search({
        genders: filters.genders.join(',') || undefined,
        interests: filters.interests.join(',') || undefined,
        minAge: filters.minAge,
        maxAge: filters.maxAge,
        goal: filters.goal || undefined,
        location: filters.location || undefined,
        q: filters.q || undefined,
        limit: 24,
      })
      setResults(data.items)
      setSearchState('ready')
    } catch (cause) {
      toast.error(cause?.message || 'Search failed.')
      setSearchState('ready')
    }
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setResults([])
    setSearchState('idle')
  }

  async function confirmBlock() {
    if (!blocking) return
    setBusy(true)
    try {
      await api.moderation.block(blocking.id)
      toast.success(`${blocking.firstName} is blocked. They can no longer see you.`)
      setQueue((current) => current.filter((item) => item.id !== blocking.id))
      setResults((current) => current.filter((item) => item.id !== blocking.id))
      setViewing(null)
      setBlocking(null)
    } catch (cause) {
      toast.error(cause?.message || 'Could not block this member.')
    } finally {
      setBusy(false)
    }
  }

  if (!profileComplete) {
    return (
      <div className="container section">
        <Card>
          <CardBody>
            <h2>Finish your profile to start discovering</h2>
            <p className="card-desc">
              Discovery uses your age, location and dating preferences to show you people who
              could actually match with you.
            </p>
            <Link className="btn btn-accent" to="/onboarding">
              Complete onboarding
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="container section discover-page">
      <div className="discover-head">
        <div>
          <h1>Discover</h1>
          <p className="card-desc">People who match your preferences - and whose preferences match you.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Discover mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'deck'}
            className={`segmented-item${mode === 'deck' ? ' active' : ''}`}
            onClick={() => setMode('deck')}
          >
            ♥ Deck
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'search'}
            className={`segmented-item${mode === 'search' ? ' active' : ''}`}
            onClick={() => setMode('search')}
          >
             Search & filters
          </button>
        </div>
      </div>

      {mode === 'deck' ? (
        <div className="discover-deck">
          {deckState === 'loading' ? <p className="muted">Loading profiles…</p> : null}
          {deckState === 'error' ? (
            <Card>
              <CardBody>
                <p>Could not reach the API.</p>
                <Button onClick={loadDeck}>Try again</Button>
              </CardBody>
            </Card>
          ) : null}
          {deckState === 'empty' || (deckState === 'ready' && !card) ? (
            <Card>
              <CardBody style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40 }} aria-hidden="true">
                  🌙
                </div>
                <h3>No one new right now</h3>
                <p className="card-desc">
                  You have seen everyone who fits your preferences. Widen your age range or
                  preferences and check back later.
                </p>
                <div className="row-actions" style={{ justifyContent: 'center' }}>
                  <Button variant="ghost" onClick={loadDeck}>
                    Refresh deck
                  </Button>
                  <Link className="btn" to="/profile/edit">
                    Edit preferences
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {card ? (
            <>
              <ProfileCard
                card={card}
                onOpen={() => setViewing(card)}
                actions={
                  <>
                    <Button
                      variant="ghost"
                      className="swipe-btn swipe-pass"
                      disabled={busy}
                      onClick={() => decide(card, 'PASS')}
                      aria-label="Pass"
                    >
                      ✕
                    </Button>
                    <Button variant="ghost" onClick={() => setViewing(card)} aria-label="View profile">
                      ⓘ
                    </Button>
                    <Button
                      variant="accent"
                      className="swipe-btn swipe-like"
                      disabled={busy}
                      onClick={() => decide(card, 'LIKE')}
                      aria-label="Like"
                    >
                      ♥
                    </Button>
                  </>
                }
              />
              <p className="tiny muted" style={{ textAlign: 'center' }}>
                {queue.length - index} profile{queue.length - index === 1 ? '' : 's'} left in this
                batch
              </p>
            </>
          ) : null}
        </div>
      ) : (
        <div className="discover-search">
          <Card>
            <CardHead title="Filters" action={<Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>} />
            <CardBody>
              <div className="filter-grid">
                <Field label="Looking for">
                  <ChipGroup
                    options={genders}
                    value={filters.genders}
                    getKey={(option) => option.value}
                    getLabel={(option) => option.label}
                    onChange={(gendersNext) => setFilters((f) => ({ ...f, genders: gendersNext }))}
                  />
                </Field>
                <Field label="Age range">
                  <div className="row-actions">
                    <TextInput
                      type="number"
                      min={18}
                      max={99}
                      value={filters.minAge}
                      aria-label="Minimum age"
                      onChange={(event) =>
                        setFilters((f) => ({ ...f, minAge: Number(event.target.value) || 18 }))
                      }
                    />
                    <span className="muted">–</span>
                    <TextInput
                      type="number"
                      min={18}
                      max={99}
                      value={filters.maxAge}
                      aria-label="Maximum age"
                      onChange={(event) =>
                        setFilters((f) => ({ ...f, maxAge: Number(event.target.value) || 99 }))
                      }
                    />
                  </div>
                </Field>
                <Field label="Relationship goal">
                  <Select
                    value={filters.goal}
                    onChange={(event) => setFilters((f) => ({ ...f, goal: event.target.value }))}
                  >
                    <option value="">Any goal</option>
                    {relationshipGoals.map((goal) => (
                      <option key={goal.value} value={goal.value}>
                        {goal.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="City or country">
                  <TextInput
                    value={filters.location}
                    placeholder="e.g. Accra"
                    onChange={(event) => setFilters((f) => ({ ...f, location: event.target.value }))}
                  />
                </Field>
                <Field label="Name or bio contains">
                  <TextInput
                    value={filters.q}
                    placeholder="e.g. chef"
                    onChange={(event) => setFilters((f) => ({ ...f, q: event.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Shared interests">
                <div className="filter-interests">
                  <ChipGroup
                    options={catalogueInterests}
                    value={filters.interests}
                    onChange={(interestsNext) => setFilters((f) => ({ ...f, interests: interestsNext }))}
                  />
                </div>
              </Field>
              <div className="row-actions">
                <Button onClick={runSearch} loading={searchState === 'loading'}>
                  Search profiles
                </Button>
              </div>
            </CardBody>
          </Card>

          {searchState === 'ready' ? (
            results.length ? (
              <div className="profile-grid">
                {results.map((item) => (
                  <ProfileCard
                    key={item.id}
                    card={item}
                    compact
                    onOpen={() => setViewing(item)}
                    actions={
                      <>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(item, 'PASS')}>
                          Pass
                        </Button>
                        <Button size="sm" variant="accent" disabled={busy} onClick={() => decide(item, 'LIKE')}>
                          Like
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="muted">Nobody fits those filters right now. Try widening them.</p>
            )
          ) : null}
        </div>
      )}

      {viewing ? (
        <Modal
          open
          title={`${viewing.fullName}${viewing.age ? `, ${viewing.age}` : ''}`}
          description={viewing.location || undefined}
          onClose={() => setViewing(null)}
        >
          <div className="view-profile">
            {viewing.profileImage ? (
              <img className="view-profile-photo" src={viewing.profileImage} alt={`${viewing.fullName}'s profile photo`} />
            ) : null}
            {viewing.relationshipGoal ? (
              <span className="badge badge-goal">{labelFor(viewing.relationshipGoal)}</span>
            ) : null}
            {viewing.bio ? <p>{viewing.bio}</p> : null}
            {viewing.interests?.length ? (
              <div className="chip-row">
                {viewing.interests.map((slug) => (
                  <Chip key={slug} size="sm" disabled>
                    {labelFor(slug)}
                  </Chip>
                ))}
              </div>
            ) : null}
            <div className="row-actions">
              <Button variant="accent" disabled={busy} onClick={() => decide(viewing, 'LIKE')}>
                ♥ Like
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => decide(viewing, 'PASS')}>
                ✕ Pass
              </Button>
            </div>
            <div className="row-actions">
              <Button variant="ghost" size="sm" onClick={() => setReporting(viewing)}>
                Report
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBlocking(viewing)}>
                Block
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {reporting ? <ReportDialog target={reporting} onClose={() => setReporting(null)} /> : null}

      {blocking ? (
        <Modal
          open
          title={`Block ${blocking.firstName}?`}
          description="They will disappear from your deck and you from theirs. Any match and its messages are removed."
          confirmLabel="Block"
          variant="danger"
          busy={busy}
          onConfirm={confirmBlock}
          onClose={() => setBlocking(null)}
        />
      ) : null}

      {match ? <MatchModal match={match} onClose={() => setMatch(null)} /> : null}
    </div>
  )
}

export default Discover

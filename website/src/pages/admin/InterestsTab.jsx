import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHead } from '../../components/ui/Card'
import { TextInput } from '../../components/ui/Field'
import { useToast } from '../../hooks/useToast'
import { api } from '../../lib/api'

/** Dating categories / interests manager. */
export function InterestsTab() {
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState({ label: '', emoji: '', category: '' })
  const [busySlug, setBusySlug] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.admin.interests()
      setItems(data.items)
      setError(null)
    } catch (cause) {
      setError(cause?.message || 'Could not load interests.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(event) {
    event.preventDefault()
    setAdding(true)
    try {
      const created = await api.admin.createInterest({
        label: draft.label,
        emoji: draft.emoji || undefined,
        category: draft.category || undefined,
      })
      toast.success(`"${created.label}" added to the catalogue.`)
      setDraft({ label: '', emoji: '', category: '' })
      await load()
    } catch (cause) {
      toast.error(cause?.fields?.label || cause?.message || 'Could not add that interest.')
    } finally {
      setAdding(false)
    }
  }

  async function toggle(entry) {
    setBusySlug(entry.slug)
    try {
      await api.admin.updateInterest(entry.slug, { active: !entry.active })
      toast.success(entry.active ? `"${entry.label}" hidden from pickers.` : `"${entry.label}" is back.`)
      await load()
    } catch (cause) {
      toast.error(cause?.message || 'Could not update that interest.')
    } finally {
      setBusySlug(null)
    }
  }

  async function remove(entry) {
    setBusySlug(entry.slug)
    try {
      await api.admin.deleteInterest(entry.slug)
      toast.success(`"${entry.label}" deleted.`)
      await load()
    } catch (cause) {
      toast.error(cause?.message || 'Could not delete that interest.')
    } finally {
      setBusySlug(null)
    }
  }

  const categories = items ? [...new Set(items.map((entry) => entry.category))] : []

  return (
    <Card>
      <CardHead
        title="Dating categories & interests"
        description="Interests power onboarding, profile pickers and the premium interest filter. Deactivating hides an option without touching existing profiles."
      />
      <CardBody>
        <form className="admin-toolbar" onSubmit={add}>
          <TextInput
            value={draft.label}
            placeholder="New interest (e.g. Afrobeats)"
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
          <TextInput
            value={draft.emoji}
            placeholder="Emoji"
            className="admin-emoji-input"
            onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
          />
          <TextInput
            value={draft.category}
            placeholder="Category"
            list="interest-categories"
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
          <datalist id="interest-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <Button type="submit" loading={adding}>
            Add interest
          </Button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        {!items && !error ? <p className="muted">Loading the catalogue…</p> : null}

        {items ? (
          <ul className="admin-list admin-interests">
            {items.map((entry) => (
              <li key={entry.slug} className={entry.active ? '' : 'interest-inactive'}>
                <span className="interest-emoji" aria-hidden="true">
                  {entry.emoji}
                </span>
                <strong>{entry.label}</strong>
                <span className="tiny muted">{entry.slug}</span>
                <span className="badge badge-info">{entry.category}</span>
                {!entry.active ? <span className="badge badge-warn">HIDDEN</span> : null}
                <span className="admin-interest-actions">
                  <Button size="sm" variant="ghost" disabled={busySlug === entry.slug} onClick={() => toggle(entry)}>
                    {entry.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button size="sm" variant="danger" disabled={busySlug === entry.slug} onClick={() => remove(entry)}>
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  )
}

export default InterestsTab

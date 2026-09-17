import { useState } from 'react'

import { api } from '../lib/api'
import { Field, Select, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'
import { useToast } from '../hooks/useToast'

const REASONS = [
  { value: 'FAKE_PROFILE', label: 'Fake profile or impersonation' },
  { value: 'HARASSMENT', label: 'Harassment or abuse' },
  { value: 'SPAM', label: 'Spam or scamming' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate photos or content' },
  { value: 'UNDERAGE', label: 'Looks under 18' },
  { value: 'OTHER', label: 'Something else' },
]

/** Report a member. The reported person is never told who reported them. */
export function ReportDialog({ target, onClose }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!target) return null

  async function submit() {
    if (!reason) {
      setError('Pick the closest reason.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.moderation.report(target.id, { reason, details: details || undefined })
      toast.success('Report sent. Our moderators will review it - thank you.')
      onClose()
    } catch (cause) {
      setError(cause?.message || 'Could not send the report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={`Report ${target.firstName || target.fullName}`}
      description="Reports are confidential. The member will not see who reported them."
      confirmLabel="Send report"
      variant="danger"
      busy={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      <Field label="Reason" error={error}>
        <Select value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Choose a reason…</option>
          {REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Details (optional)" hint="Anything that helps moderators act faster.">
        <TextInput
          value={details}
          maxLength={500}
          placeholder="What happened?"
          onChange={(event) => setDetails(event.target.value)}
        />
      </Field>
    </Modal>
  )
}

export default ReportDialog

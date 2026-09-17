import { useState } from 'react'

import { api } from '../lib/api'
import { useToast } from '../hooks/useToast'
import { Field, Select, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

const MOMO_PROVIDERS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'telecel', label: 'Telecel Cash' },
  { value: 'at', label: 'AT Money' },
]

/**
 * Paystack checkout: pick card or Ghana Mobile Money, start the charge, and
 * either hand the customer to Paystack (live) or simulate the wallet
 * approval (mock mode, which is what dev/demo runs use).
 */
export function CheckoutModal({ plan, onClose, onActivated }) {
  const toast = useToast()
  const [channel, setChannel] = useState('mobile_money')
  const [provider, setProvider] = useState('mtn')
  const [phone, setPhone] = useState('')
  const [stage, setStage] = useState('form') // form | approve | done
  const [checkout, setCheckout] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!plan) return null

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const data = await api.billing.checkout({
        plan: plan.value,
        channel,
        phone: channel === 'mobile_money' ? phone : undefined,
        provider: channel === 'mobile_money' ? provider : undefined,
      })
      setCheckout(data)
      if (data.mode === 'mock') {
        setStage('approve')
      } else {
        window.localStorage.setItem('streetmeet.pendingReference', data.reference)
        window.location.href = data.checkoutUrl
      }
    } catch (cause) {
      setError(cause?.fields?.phone || cause?.message || 'Checkout failed.')
    } finally {
      setBusy(false)
    }
  }

  async function approveAndVerify() {
    setBusy(true)
    setError(null)
    try {
      await api.billing.mockPay(checkout.reference)
      const result = await api.billing.verify(checkout.reference)
      if (!result.active) throw new Error('Payment not confirmed yet.')
      setStage('done')
      toast.success(`${result.plan} is live - thank you!`)
      await onActivated?.()
    } catch (cause) {
      setError(cause?.message || 'Could not confirm the payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={stage === 'done' ? 'You are upgraded!' : `Upgrade to ${plan.label}`}
      description={
        stage === 'form'
          ? `GHS ${plan.priceGhs} for ${plan.periodDays} days. Pay with card or mobile money via Paystack.`
          : stage === 'approve'
            ? 'Charge created. In mock mode you approve the wallet prompt yourself.'
            : 'Your paid plan is active now.'
      }
      confirmLabel={stage === 'form' ? 'Start payment' : stage === 'approve' ? 'Simulate approval' : null}
      variant="accent"
      busy={busy}
      onConfirm={stage === 'form' ? start : stage === 'approve' ? approveAndVerify : undefined}
      onClose={onClose}
    >
      {stage === 'form' ? (
        <>
          <Field label="Payment channel">
            <div className="channel-picker">
              {[
                { value: 'mobile_money', label: '📱 Mobile money', hint: 'MTN, Telecel, AT' },
                { value: 'card', label: '💳 Card', hint: 'Visa, Mastercard' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="option-card"
                  aria-pressed={channel === option.value}
                  onClick={() => setChannel(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>
          </Field>
          {channel === 'mobile_money' ? (
            <>
              <Field label="Wallet provider">
                <Select value={provider} onChange={(event) => setProvider(event.target.value)}>
                  {MOMO_PROVIDERS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Wallet phone number" error={error}>
                <TextInput
                  value={phone}
                  placeholder="0244 000 000"
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>
            </>
          ) : (
            error ? <p className="error-text">{error}</p> : null
          )}
        </>
      ) : null}

      {stage === 'approve' ? (
        <div className="checkout-approve">
          <p>
            Reference <code>{checkout.reference}</code>
          </p>
          <p className="muted">
            On a live deployment Paystack hosts this step (OTP / wallet prompt). Mock mode lets you
            approve it here so the whole activation path is testable offline.
          </p>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      ) : null}

      {stage === 'done' ? (
        <p className="muted">Perks are active across the app already.</p>
      ) : null}
    </Modal>
  )
}

export default CheckoutModal

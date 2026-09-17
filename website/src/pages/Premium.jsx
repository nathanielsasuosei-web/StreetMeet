import { useEffect, useState } from 'react'

import { CheckoutModal } from '../components/CheckoutModal'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHead } from '../components/ui/Card'
import { usePlan } from '../hooks/usePlan'
import { useToast } from '../hooks/useToast'
import { api } from '../lib/api'
import { cx, formatDate } from '../lib/format'

/**
 * Plans & billing: the Free / Premium / VIP catalogue, the member's current
 * subscription and the Paystack checkout (card + Ghana Mobile Money).
 */
export function Premium() {
  const { plan, plans, subscription, isLoading, refresh } = usePlan()
  const toast = useToast()
  const [choosing, setChoosing] = useState(null)
  const [history, setHistory] = useState(null)
  const [checkingReturn, setCheckingReturn] = useState(false)

  /* Returning from Paystack's hosted checkout: confirm and activate. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference =
      params.get('reference') || window.localStorage.getItem('streetmeet.pendingReference')
    if (!reference) return undefined

    let active = true
    setCheckingReturn(true)
    let attempt = 0

    async function poll() {
      attempt += 1
      try {
        const result = await api.billing.verify(reference)
        if (!active) return
        window.localStorage.removeItem('streetmeet.pendingReference')
        if (result.active) {
          toast.success(`${result.plan} is live - thank you!`)
          await refresh()
          setCheckingReturn(false)
          return
        }
        if (attempt < 6) {
          setTimeout(poll, 2000)
          return
        }
        setCheckingReturn(false)
      } catch {
        if (active) setCheckingReturn(false)
      }
    }

    poll()
    return () => {
      active = false
    }
  }, [refresh, toast])

  useEffect(() => {
    let active = true
    api
      .billing.subscription()
      .then((data) => {
        if (active) setHistory(data.history)
      })
      .catch(() => {
        if (active) setHistory([])
      })
    return () => {
      active = false
    }
  }, [subscription])

  return (
    <div className="container section">
      <div className="page-head">
        <div>
          <h1>Plans & billing</h1>
          <p className="card-desc">
            Payments run through Paystack - card or Ghana Mobile Money. Subscriptions activate the
            moment Paystack confirms the charge and expire when the period ends.
          </p>
        </div>
        <span className={cx('badge', plan === 'FREE' ? 'badge-info' : 'badge-vip')}>
          {checkingReturn ? 'Confirming payment…' : `Current plan: ${plan || '…'}`}
        </span>
      </div>

      {isLoading ? <p className="muted">Loading plans…</p> : null}

      <div className="plan-grid">
        {plans.map((entry) => {
          const current = entry.value === plan
          return (
            <Card key={entry.value} className={cx('plan-card', current && 'plan-card-current')}>
              <CardHead
                title={
                  <>
                    {entry.label}
                    {entry.value === 'VIP' ? <span className="badge badge-vip">★</span> : null}
                  </>
                }
                description={entry.tagline}
              />
              <CardBody>
                <p className="plan-price">
                  <strong>GHS {entry.priceGhs}</strong>
                  <span className="muted">
                    {entry.periodDays ? ` / ${entry.periodDays} days` : ' / forever'}
                  </span>
                </p>
                <ul className="plan-features">
                  {entry.features.map((feature) => (
                    <li key={feature}>
                      <span aria-hidden="true">✓</span> {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={current ? 'ghost' : entry.value === 'FREE' ? 'ghost' : 'accent'}
                  disabled={current}
                  onClick={() => setChoosing(entry)}
                >
                  {current ? 'Current plan' : entry.priceGhs === 0 ? 'Included' : `Choose ${entry.label}`}
                </Button>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {subscription ? (
        <Card>
          <CardHead
            title="Active subscription"
            description={`Started ${formatDate(subscription.startedAt)} - renews by ${formatDate(subscription.expiresAt)}.`}
          />
          <CardBody>
            <p>
              <strong>{subscription.plan}</strong>{' '}
              <span className="muted">
                via {subscription.channel === 'mobile_money' ? 'mobile money' : subscription.channel}
              </span>
            </p>
          </CardBody>
        </Card>
      ) : null}

      {history?.length ? (
        <Card>
          <CardHead title="Billing history" />
          <CardBody>
            <ul className="billing-history">
              {history.map((row) => (
                <li key={row.id}>
                  <span className={cx('badge', row.active ? 'badge-brand' : 'badge-info')}>
                    {row.status}
                  </span>
                  <strong>{row.plan}</strong>
                  <span className="muted">GHS {row.amountGhs}</span>
                  <span className="tiny muted">
                    {row.expiresAt ? `expired/expiry ${formatDate(row.expiresAt)}` : 'awaiting payment'}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {choosing ? (
        <CheckoutModal
          plan={choosing}
          onClose={() => setChoosing(null)}
          onActivated={async () => {
            setChoosing(null)
            await refresh()
          }}
        />
      ) : null}
    </div>
  )
}

export default Premium

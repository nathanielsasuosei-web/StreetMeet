import { useCallback, useEffect, useState } from 'react'

import { api } from '../lib/api'

/**
 * The member's subscription state (plan, perks, limits, plan catalogue),
 * cached for the life of the tab so the navbar badge, the discover page and
 * the plans page share one request. `refresh` re-fetches after a payment.
 */
let cached = null
let inflight = null

function loadPlans() {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = api
      .billing.plans()
      .then((data) => {
        cached = data
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function usePlan() {
  const [data, setData] = useState(cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    loadPlans()
      .then((payload) => {
        if (active) setData(payload)
      })
      .catch((cause) => {
        if (active) setError(cause)
      })
    return () => {
      active = false
    }
  }, [])

  const refresh = useCallback(async () => {
    cached = null
    try {
      setData(await loadPlans())
      setError(null)
    } catch (cause) {
      setError(cause)
    }
  }, [])

  return {
    plan: data?.plan ?? null,
    perks: data?.perks ?? {},
    plans: data?.plans ?? [],
    subscription: data?.subscription ?? null,
    limits: data?.limits ?? {},
    isLoading: !data && !error,
    error,
    refresh,
  }
}

export default usePlan

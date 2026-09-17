import { useEffect, useState } from 'react'

import { api } from '../lib/api'

/**
 * The interest / gender / relationship-goal catalogue from the API, cached for
 * the life of the tab so the onboarding wizard and the edit form share one
 * request.
 */
let cached = null
let inflight = null

async function loadCatalogue() {
  if (cached) return cached
  if (!inflight) {
    inflight = api
      .catalogue()
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

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState(cached)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(!cached)

  useEffect(() => {
    let active = true
    if (cached) {
      setCatalogue(cached)
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    loadCatalogue()
      .then((data) => {
        if (!active) return
        setCatalogue(data)
        setIsLoading(false)
      })
      .catch((cause) => {
        if (!active) return
        setError(cause)
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return {
    catalogue,
    isLoading,
    error,
    interests: catalogue?.interests ?? [],
    genders: catalogue?.genders ?? [],
    relationshipGoals: catalogue?.relationshipGoals ?? [],
    limits: catalogue?.limits ?? { interestsMin: 3, interestsMax: 10, bioMaxLength: 500, minAge: 18, maxAge: 99 },
  }
}

export default useCatalogue

import { useCallback, useState } from 'react'

import { ApiError } from '../lib/api'

/**
 * Form state + server error mapping.
 *
 * The API answers validation failures with `{ message, fields: { name: msg } }`;
 * this hook spreads those onto the matching inputs and keeps a banner message
 * for anything that is not field specific.
 */
export function useForm({ initial = {}, onSubmit, validate }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current))
  }, [])

  const setMany = useCallback((patch) => {
    setValues((current) => ({ ...current, ...patch }))
  }, [])

  const reset = useCallback((next) => {
    setValues(next ?? initial)
    setErrors({})
    setFormError(null)
  }, [initial])

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.()
      setFormError(null)
      setErrors({})

      if (validate) {
        const problems = validate(values) || {}
        const keys = Object.keys(problems).filter((key) => problems[key])
        if (keys.length) {
          setErrors(problems)
          setFormError(problems[keys[0]])
          return undefined
        }
      }

      setSubmitting(true)
      try {
        return await onSubmit(values)
      } catch (error) {
        if (error instanceof ApiError) {
          const fields = error.fields || {}
          setErrors(fields)
          setFormError(Object.keys(fields).length ? null : error.message)
        } else {
          setFormError(error?.message || 'Something went wrong. Please try again.')
        }
        return undefined
      } finally {
        setSubmitting(false)
      }
    },
    [onSubmit, validate, values],
  )

  return {
    values,
    setValues,
    setField,
    setMany,
    reset,
    errors,
    setErrors,
    formError,
    setFormError,
    submitting,
    handleSubmit,
  }
}

export default useForm

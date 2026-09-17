import { useId, useState } from 'react'

import { cx } from '../../lib/format'

/** Label + control + hint/error, wired up for accessibility. */
export function Field({ label, error, hint, required, optional, children, counter, htmlFor }) {
  const generatedId = useId()
  const id = htmlFor || generatedId

  return (
    <div className="field">
      {label ? (
        <label className="label" htmlFor={id}>
          <span>
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </span>
          {optional ? <span className="optional">optional</span> : null}
          {counter !== undefined ? counter : null}
        </label>
      ) : null}

      {typeof children === 'function' ? children({ id, error }) : children}

      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      ) : hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

export function TextInput({ id, error, hint, className, ...rest }) {
  return (
    <input
      id={id}
      className={cx('input', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error, hint)}
      {...rest}
    />
  )
}

export function TextArea({ id, error, hint, className, ...rest }) {
  return (
    <textarea
      id={id}
      className={cx('textarea', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error, hint)}
      {...rest}
    />
  )
}

export function Select({ id, error, hint, className, options = [], placeholder, ...rest }) {
  return (
    <select
      id={id}
      className={cx('select', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error, hint)}
      {...rest}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) =>
        typeof option === 'string' ? (
          <option key={option} value={option}>
            {option}
          </option>
        ) : (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  )
}

export function PasswordInput({ id, error, hint, className, ...rest }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="input-affix">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={cx('input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
      <button
        type="button"
        className="affix-btn"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export default Field

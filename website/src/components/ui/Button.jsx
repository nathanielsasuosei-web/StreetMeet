import { Link } from 'react-router-dom'

import { cx } from '../../lib/format'

/**
 * One button for the whole app. Renders as <button>, or as a router <Link>
 * when given `to`, or as an <a> when given `href`.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  to,
  href,
  className,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = cx(
    'btn',
    variant !== 'primary' && `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    block && 'btn-block',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={disabled || undefined} {...rest}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export default Button

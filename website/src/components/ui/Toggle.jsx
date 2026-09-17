import { cx } from '../../lib/format'

/** Accessible switch. `title`/`description` render the usual settings row. */
export function Toggle({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  id,
  className,
}) {
  const control = (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={title || 'Toggle'}
      className={cx('switch', className)}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    />
  )

  if (!title && !description) return control

  return (
    <div className="toggle-row">
      <div className="toggle-copy">
        {title ? <strong>{title}</strong> : null}
        {description ? <span>{description}</span> : null}
      </div>
      {control}
    </div>
  )
}

export default Toggle

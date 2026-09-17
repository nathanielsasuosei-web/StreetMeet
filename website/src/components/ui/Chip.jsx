import { cx } from '../../lib/format'

/** Selectable pill - used for interests, genders and relationship goals. */
export function Chip({ children, selected = false, onClick, emoji, disabled, size }) {
  return (
    <button
      type="button"
      className={cx('chip', size === 'sm' && 'btn-sm')}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {emoji ? (
        <span className="chip-emoji" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      {children}
    </button>
  )
}

/**
 * Multi-select chip group with a maximum. `value` is an array of slugs.
 */
export function ChipGroup({ options, value = [], onChange, max, min = 0, getKey, getLabel, getEmoji }) {
  const keyOf = getKey || ((option) => option.slug ?? option.value ?? option)
  const labelOf = getLabel || ((option) => option.label ?? option)
  const emojiOf = getEmoji || ((option) => option.emoji)

  const toggle = (key) => {
    const selected = value.includes(key)
    if (selected) {
      if (min && value.length <= min) return
      onChange(value.filter((item) => item !== key))
      return
    }
    if (max && value.length >= max) return
    onChange([...value, key])
  }

  return (
    <div className="chip-group">
      {options.map((option) => {
        const key = keyOf(option)
        const isSelected = value.includes(key)
        const atLimit = !isSelected && max && value.length >= max

        return (
          <Chip
            key={key}
            emoji={emojiOf(option)}
            selected={isSelected}
            disabled={Boolean(atLimit)}
            onClick={() => toggle(key)}
          >
            {labelOf(option)}
          </Chip>
        )
      })}
    </div>
  )
}

export default Chip

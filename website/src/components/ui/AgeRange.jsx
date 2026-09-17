/** Two linked sliders for the "interested in ages X-Y" preference. */
export function AgeRange({ min = 18, max = 45, floor = 18, ceiling = 70, onChange }) {
  const update = (nextMin, nextMax) => {
    const safeMin = Math.min(Math.max(nextMin, floor), ceiling)
    const safeMax = Math.min(Math.max(nextMax, floor), ceiling)
    onChange?.({
      minAge: Math.min(safeMin, safeMax),
      maxAge: Math.max(safeMin, safeMax),
    })
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="range-row">
        <span className="range-value">{min}</span>
        <input
          type="range"
          min={floor}
          max={ceiling}
          value={min}
          aria-label="Minimum age"
          onChange={(event) => update(Number(event.target.value), max)}
        />
      </div>

      <div className="range-row">
        <span className="range-value">{max >= ceiling ? `${ceiling}+` : max}</span>
        <input
          type="range"
          min={floor}
          max={ceiling}
          value={max}
          aria-label="Maximum age"
          onChange={(event) => update(min, Number(event.target.value))}
        />
      </div>

      <p className="hint">
        You will see people aged <strong className="strong">{min}</strong> to{' '}
        <strong className="strong">{max >= ceiling ? `${ceiling}+` : max}</strong>.
      </p>
    </div>
  )
}

export default AgeRange

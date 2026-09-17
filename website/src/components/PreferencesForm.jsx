import { AgeRange } from './ui/AgeRange'
import { ChipGroup } from './ui/Chip'
import { Toggle } from './ui/Toggle'

const DISTANCES = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 250, label: '250 km' },
  { value: null, label: 'Anywhere' },
]

/**
 * Dating preferences - the same control surface in the sign-up wizard, on the
 * edit-profile page and in account settings.
 *
 * `value` shape: { interestedIn: [], minAge, maxAge, maxDistanceKm, relationshipGoal, openToNearby }
 */
export function PreferencesForm({ value, onChange, genders = [], goals = [], errors = {} }) {
  const set = (patch) => onChange?.({ ...value, ...patch })

  return (
    <div className="stack" style={{ gap: 26 }}>
      <div className="stack" style={{ gap: 10 }}>
        <span className="label">Who do you want to meet?</span>
        <ChipGroup
          options={genders}
          value={value.interestedIn || []}
          min={1}
          onChange={(interestedIn) => set({ interestedIn })}
          getKey={(option) => option.value}
          getLabel={(option) => option.label}
        />
        {errors.interestedIn ? <p className="error-text">{errors.interestedIn}</p> : null}
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <span className="label">Age range</span>
        <AgeRange
          min={value.minAge ?? 18}
          max={value.maxAge ?? 45}
          onChange={({ minAge, maxAge }) => set({ minAge, maxAge })}
        />
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <span className="label">Maximum distance</span>
        <div className="chip-group">
          {DISTANCES.map((option) => {
            const selected = (value.maxDistanceKm ?? null) === option.value
            return (
              <button
                key={option.label}
                type="button"
                className="chip"
                aria-pressed={selected}
                onClick={() => set({ maxDistanceKm: option.value })}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="hint">
          {value.maxDistanceKm
            ? `We will show people within ${value.maxDistanceKm} km of you.`
            : 'Distance is off - you can meet people anywhere.'}
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <span className="label">What are you looking for?</span>
        <div className="option-grid">
          {goals.map((goal) => (
            <button
              key={goal.value}
              type="button"
              className="option-card"
              aria-pressed={value.relationshipGoal === goal.value}
              onClick={() =>
                set({
                  relationshipGoal: value.relationshipGoal === goal.value ? null : goal.value,
                })
              }
            >
              <strong>{goal.label}</strong>
              {goal.hint ? <span>{goal.hint}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Toggle
          checked={value.openToNearby !== false}
          onChange={(openToNearby) => set({ openToNearby })}
          title="Show me people near me first"
          description="Prioritise members in your city over everyone else."
        />
      </div>
    </div>
  )
}

export default PreferencesForm

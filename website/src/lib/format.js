/** Small presentation helpers shared by the UI. */

export function cx(...values) {
  return values.filter(Boolean).join(' ')
}

export function ageFrom(birthDate) {
  if (!birthDate) return null
  const birth = new Date(String(birthDate).slice(0, 10))
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 150 ? age : null
}

export function initialsOf(name = '') {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'SM'
  )
}

export function labelFor(value = '') {
  const text = String(value).replace(/_/g, ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A stable colour per member, used for initial avatars. */
/** Compact relative time ("now", "4m", "3h", "2d") for lists and badges. */
export function timeAgo(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w`
  return formatDate(value)
}

export function avatarGradient(seed = '') {
  const hues = [152, 340, 24, 268, 200, 96]
  let hash = 0
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) % 100000
  const hue = hues[hash % hues.length]
  return `linear-gradient(135deg, hsl(${hue} 72% 58%), hsl(${(hue + 42) % 360} 78% 46%))`
}

/** Client-side mirror of the server's password policy. */
export function passwordChecks(password = '') {
  return [
    { id: 'length', label: 'At least 8 characters', ok: password.length >= 8 },
    { id: 'letter', label: 'Contains a letter', ok: /[A-Za-z]/.test(password) },
    { id: 'number', label: 'Contains a number', ok: /\d/.test(password) },
    { id: 'no-repeat', label: 'No character repeated 4+ times', ok: !/(.)\1{3,}/.test(password) },
  ]
}

export function passwordScore(password = '') {
  const checks = passwordChecks(password)
  const passed = checks.filter((check) => check.ok).length
  const bonus = password.length >= 12 ? 1 : 0
  return Math.min(passed + bonus, checks.length + 1)
}

/** Keep a File below the upload limit and in an accepted format. */
export function imageProblem(file, { maxMb = 5, types = ['image/jpeg', 'image/png', 'image/webp'] } = {}) {
  if (!file) return 'Choose an image file.'
  if (!types.includes(file.type)) return 'Use a JPG, PNG or WebP image.'
  if (file.size > maxMb * 1024 * 1024) return `That image is larger than ${maxMb} MB.`
  return null
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

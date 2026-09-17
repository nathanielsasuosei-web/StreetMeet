import { avatarGradient, cx, initialsOf } from '../../lib/format'

/**
 * Profile photo with an initials fallback. `seed` keeps the gradient stable
 * for a given member.
 */
export function Avatar({ src, name = '', size = 'md', verified = false, className, empty }) {
  const showImage = Boolean(src) && !empty

  return (
    <span
      className={cx('avatar', `avatar-${size}`, !showImage && 'avatar-empty', className)}
      style={showImage ? undefined : { background: avatarGradient(name || 'streetmeet') }}
      aria-hidden={showImage ? undefined : 'true'}
    >
      {showImage ? (
        <img src={src} alt={name ? `${name}'s profile photo` : 'Profile photo'} loading="lazy" />
      ) : (
        <span>{name ? initialsOf(name) : '👤'}</span>
      )}
      {verified ? (
        <span className="verified-dot" title="Verified">
          ✓
        </span>
      ) : null}
    </span>
  )
}

export default Avatar

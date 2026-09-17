import { useRef, useState } from 'react'

import { cx, imageProblem, initialsOf } from '../../lib/format'

/**
 * Profile photo picker: click or drag & drop, instant local preview, then the
 * parent uploads it (the API re-encodes and resizes it).
 */
export function PhotoUploader({
  value,
  name = '',
  onUpload,
  onRemove,
  busy = false,
  error = null,
  hint = 'JPG, PNG or WebP · up to 5 MB · square works best',
  size = 168,
  required = false,
}) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState(null)

  const shown = preview || value
  const message = localError || error

  async function handleFile(file) {
    setLocalError(null)
    const problem = imageProblem(file)
    if (problem) {
      setLocalError(problem)
      return
    }

    const url = URL.createObjectURL(file)
    setPreview(url)

    try {
      await onUpload?.(file)
    } catch (cause) {
      setLocalError(cause?.message || 'That upload did not work.')
    } finally {
      setPreview(null)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="photo-uploader">
      <div
        className="photo-frame"
        style={{ width: size, height: size }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFile(event.dataTransfer.files?.[0])
        }}
      >
        {shown ? (
          <img src={shown} alt={name ? `${name}'s profile photo` : 'Profile photo preview'} />
        ) : (
          <div className="photo-frame-empty">
            <div className="avatar avatar-lg" style={{ margin: '0 auto 8px' }}>
              {initialsOf(name)}
            </div>
            No photo yet
          </div>
        )}
        {busy ? (
          <div
            className={cx('photo-frame-empty')}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(8,12,18,0.55)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span className="row" style={{ justifyContent: 'center' }}>
              <span className="spinner" /> Uploading…
            </span>
          </div>
        ) : null}
      </div>

      <div className="stack" style={{ gap: 12, width: '100%' }}>
        <div
          className="photo-drop"
          data-dragging={dragging}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
          }}
          role="button"
          tabIndex={0}
        >
          {shown ? 'Replace photo' : required ? 'Add your photo' : 'Add a photo'}
          <div className="tiny">or drag an image here</div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) handleFile(file)
          }}
        />

        <div className="row" style={{ gap: 8 }}>
          {shown && onRemove ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onRemove}
              disabled={busy}
            >
              Remove photo
            </button>
          ) : null}
        </div>

        {message ? (
          <p className="error-text" role="alert">
            <span aria-hidden="true">⚠</span> {message}
          </p>
        ) : (
          <p className="hint">{hint}</p>
        )}
      </div>
    </div>
  )
}

export default PhotoUploader

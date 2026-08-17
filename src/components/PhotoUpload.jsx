import { useRef } from 'react'
import { G } from '../utils/colors.js'

export default function PhotoUpload({ label, photos, onAdd, onRemove }) {
  const ref = useRef()
  const isUploading = photos.some(p => p.uploading)

  // Apps Script (Web App) ne traite qu'une requete a la fois : envoyer toutes
  // les photos d'une selection multiple en parallele les fait se bousculer et
  // Google renvoie parfois une page d'erreur HTML au lieu du JSON attendu.
  // On les envoie donc une par une.
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    for (const file of files) {
      await onAdd(file)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.label}>{label}</div>

      <div style={s.grid}>
        {photos.map((p, i) => (
          <div key={i} style={s.thumb}>
            <img src={p.preview} alt="" style={s.img} />
            {p.uploading && (
              <div style={s.overlay}>
                <div style={s.spinner} />
              </div>
            )}
            {!p.uploading && (
              <button style={s.remove} onClick={() => onRemove(i)}>×</button>
            )}
          </div>
        ))}

        <button
          style={{ ...s.add, ...(isUploading ? s.addDisabled : {}) }}
          onClick={() => ref.current.click()}
          disabled={isUploading}
        >
          <div style={s.addIcon}>+</div>
          <div style={s.addLabel}>{isUploading ? 'Envoi en cours…' : 'Ajouter une photo'}</div>
        </button>
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        disabled={isUploading}
        style={{ display: 'none' }}
        onChange={handleFiles}
      />
    </div>
  )
}

const s = {
  wrap: { marginBottom: 8 },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: G.gold,
    marginBottom: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  thumb: {
    position: 'relative',
    aspectRatio: '4/3',
    borderRadius: 4,
    overflow: 'hidden',
    background: '#e8e5df',
    border: `0.5px solid ${G.border}`,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(17,17,16,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: `2px solid rgba(255,255,255,0.2)`,
    borderTopColor: G.gold,
    animation: 'spin 0.8s linear infinite',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(17,17,16,0.7)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  add: {
    aspectRatio: '4/3',
    borderRadius: 4,
    border: `1.5px dashed rgba(184,151,90,0.35)`,
    background: 'rgba(184,151,90,0.04)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    gap: 4,
  },
  addDisabled: {
    cursor: 'default',
    opacity: 0.5,
  },
  addIcon: {
    fontSize: 22,
    color: G.gold,
    lineHeight: 1,
  },
  addLabel: {
    fontSize: 10,
    color: G.gold,
    letterSpacing: '0.08em',
  },
}

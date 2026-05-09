import { useState, useEffect, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { G } from '../App.jsx'
import PhotoUpload from './PhotoUpload.jsx'
import { compressAndUpload, uploadSignature } from '../utils/cloudinary.js'

const STEPS = [
  'Intervention',
  'Horaires',
  'Travaux',
  'Photos avant',
  'Photos après',
  'Signature',
  'Envoi',
]

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function InterventionForm({ token, onDone, onLogout }) {
  const [step, setStep] = useState(0)
  const [affaires, setAffaires] = useState([])
  const [loadingAff, setLoadingAff] = useState(true)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const sigRef = useRef()

  const [form, setForm] = useState({
    technicien: '',
    affaire: null,
    date: today(),
    heure_arrivee: '',
    heure_depart: '',
    equipement: '',
    diagnostic: '',
    travaux: '',
    observations: '',
    photos_avant: [],
    photos_apres: [],
    signature_url: '',
    nom_signataire: '',
  })

  useEffect(() => {
    fetch('/api/affaires', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setAffaires(Array.isArray(data) ? data : []); setLoadingAff(false) })
      .catch(() => setLoadingAff(false))
  }, [token])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // Photo handlers
  const addPhoto = async (category, file) => {
    const preview = URL.createObjectURL(file)
    const id = Date.now() + Math.random()
    const photo = { id, preview, uploading: true, url: null }

    setForm(f => ({ ...f, [category]: [...f[category], photo] }))

    try {
      const url = await compressAndUpload(file)
      setForm(f => ({
        ...f,
        [category]: f[category].map(p => p.id === id ? { ...p, uploading: false, url } : p)
      }))
    } catch {
      setForm(f => ({ ...f, [category]: f[category].filter(p => p.id !== id) }))
    }
  }

  const removePhoto = (category, index) => {
    setForm(f => ({ ...f, [category]: f[category].filter((_, i) => i !== index) }))
  }

  // Validation par étape
  const canNext = () => {
    if (step === 0) return form.technicien.trim() && form.affaire
    if (step === 1) return form.heure_arrivee && form.heure_depart
    if (step === 2) return form.equipement.trim() && form.diagnostic.trim() && form.travaux.trim()
    if (step === 3) return true
    if (step === 4) return true
    if (step === 5) return form.nom_signataire.trim()
    return true
  }

  const handleNext = async () => {
    if (step === 5) {
      // Upload signature
      if (sigRef.current && !sigRef.current.isEmpty()) {
        const dataUrl = sigRef.current.toDataURL('image/png')
        try {
          const url = await uploadSignature(dataUrl)
          set('signature_url', url)
        } catch { /* continue sans signature */ }
      }
    }
    if (step < STEPS.length - 1) setStep(s => s + 1)
    if (step === STEPS.length - 2) handleSubmit()
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        numero_affaire: form.affaire?.aff_number,
        notion_affaire_id: form.affaire?.notion_id,
        client: form.affaire?.contact,
        adresse: form.affaire?.adresse,
        date: form.date,
        technicien: form.technicien,
        heure_arrivee: form.heure_arrivee,
        heure_depart: form.heure_depart,
        equipement: form.equipement,
        diagnostic: form.diagnostic,
        travaux: form.travaux,
        observations: form.observations,
        photos_avant: form.photos_avant.filter(p => p.url).map(p => p.url),
        photos_apres: form.photos_apres.filter(p => p.url).map(p => p.url),
        signature_client: form.signature_url,
        nom_signataire: form.nom_signataire,
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onDone()
      } else {
        setError("Erreur lors de l'envoi. Réessayez.")
        setStep(STEPS.length - 2)
      }
    } catch {
      setError("Erreur réseau. Réessayez.")
      setStep(STEPS.length - 2)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = affaires.filter(a =>
    a.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>FORTIS<span style={{ color: G.gold }}>.</span></div>
          <div style={s.logoSub}>Rapport d'intervention</div>
        </div>
        <button style={s.logoutBtn} onClick={onLogout}>Quitter</button>
      </div>

      {/* Progress */}
      <div style={s.progressWrap}>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <div style={s.stepLabel}>{STEPS[step]}</div>
      </div>

      {/* Content */}
      <div style={s.content}>

        {/* ÉTAPE 0 : Technicien + Affaire */}
        {step === 0 && (
          <div>
            <Field label="Votre nom">
              <input
                style={s.input}
                placeholder="Ex : Marc-Antoine"
                value={form.technicien}
                onChange={e => set('technicien', e.target.value)}
                autoComplete="off"
              />
            </Field>

            <Field label="Affaire">
              {form.affaire ? (
                <div style={s.selectedAff}>
                  <div style={s.selectedAffLabel}>{form.affaire.label}</div>
                  <button style={s.changeBtn} onClick={() => set('affaire', null)}>Changer</button>
                </div>
              ) : (
                <div>
                  <input
                    style={{ ...s.input, marginBottom: 8 }}
                    placeholder="Rechercher… AFF-024 ou nom client"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {loadingAff ? (
                    <div style={s.hint}>Chargement des affaires…</div>
                  ) : (
                    <div style={s.affList}>
                      {filtered.length === 0 && <div style={s.hint}>Aucune affaire trouvée</div>}
                      {filtered.map(a => (
                        <button key={a.notion_id} style={s.affItem} onClick={() => { set('affaire', a); setSearch('') }}>
                          <div style={s.affNum}>{a.aff_number}</div>
                          <div style={s.affDesc}>{a.description_short}</div>
                          <div style={s.affContact}>{a.contact}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
          </div>
        )}

        {/* ÉTAPE 1 : Horaires */}
        {step === 1 && (
          <div>
            <Field label="Heure d'arrivée">
              <div style={s.timeRow}>
                <input
                  type="time"
                  style={{ ...s.input, flex: 1 }}
                  value={form.heure_arrivee}
                  onChange={e => set('heure_arrivee', e.target.value)}
                />
                <button style={s.nowBtn} onClick={() => set('heure_arrivee', nowTime())}>
                  Maintenant
                </button>
              </div>
            </Field>

            <Field label="Heure de départ">
              <div style={s.timeRow}>
                <input
                  type="time"
                  style={{ ...s.input, flex: 1 }}
                  value={form.heure_depart}
                  onChange={e => set('heure_depart', e.target.value)}
                />
                <button style={s.nowBtn} onClick={() => set('heure_depart', nowTime())}>
                  Maintenant
                </button>
              </div>
            </Field>
          </div>
        )}

        {/* ÉTAPE 2 : Travaux */}
        {step === 2 && (
          <div>
            <Field label="Équipement concerné">
              <input
                style={s.input}
                placeholder="Ex : Chaudière Vaillant, tableau électrique…"
                value={form.equipement}
                onChange={e => set('equipement', e.target.value)}
              />
            </Field>
            <Field label="Diagnostic initial">
              <textarea
                style={s.textarea}
                placeholder="Quel était le problème avant d'intervenir ?"
                value={form.diagnostic}
                onChange={e => set('diagnostic', e.target.value)}
                rows={3}
              />
            </Field>
            <Field label="Travaux réalisés">
              <textarea
                style={s.textarea}
                placeholder="Quelles actions ont été effectuées ?"
                value={form.travaux}
                onChange={e => set('travaux', e.target.value)}
                rows={4}
              />
            </Field>
            <Field label="Observations (optionnel)">
              <textarea
                style={s.textarea}
                placeholder="Anomalies constatées, recommandations…"
                value={form.observations}
                onChange={e => set('observations', e.target.value)}
                rows={2}
              />
            </Field>
          </div>
        )}

        {/* ÉTAPE 3 : Photos avant */}
        {step === 3 && (
          <PhotoUpload
            label="Photos AVANT intervention"
            photos={form.photos_avant}
            onAdd={f => addPhoto('photos_avant', f)}
            onRemove={i => removePhoto('photos_avant', i)}
          />
        )}

        {/* ÉTAPE 4 : Photos après */}
        {step === 4 && (
          <PhotoUpload
            label="Photos APRÈS intervention"
            photos={form.photos_apres}
            onAdd={f => addPhoto('photos_apres', f)}
            onRemove={i => removePhoto('photos_apres', i)}
          />
        )}

        {/* ÉTAPE 5 : Signature */}
        {step === 5 && (
          <div>
            <Field label="Signature du client">
              <div style={s.sigWrap}>
                <SignatureCanvas
                  ref={sigRef}
                  penColor={G.ink}
                  canvasProps={{ style: { width: '100%', height: 150, borderRadius: 4 } }}
                  backgroundColor="white"
                />
                <button style={s.clearSig} onClick={() => sigRef.current?.clear()}>
                  Effacer
                </button>
              </div>
            </Field>
            <Field label="Nom du signataire">
              <input
                style={s.input}
                placeholder="Ex : M. Dupont"
                value={form.nom_signataire}
                onChange={e => set('nom_signataire', e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* ÉTAPE 6 : Envoi */}
        {step === 6 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {submitting ? (
              <div>
                <div style={s.sendSpinner} />
                <div style={s.sendLabel}>Génération du rapport…</div>
              </div>
            ) : error ? (
              <div>
                <div style={{ color: '#e05c5c', marginBottom: 20 }}>{error}</div>
                <button style={s.retryBtn} onClick={handleSubmit}>Réessayer</button>
              </div>
            ) : null}
          </div>
        )}

      </div>

      {/* Footer Navigation */}
      {step < 6 && (
        <div style={s.nav}>
          {step > 0 && (
            <button style={s.backBtn} onClick={() => setStep(s => s - 1)}>
              ← Retour
            </button>
          )}
          <button
            style={{ ...s.nextBtn, opacity: canNext() ? 1 : 0.4, marginLeft: step === 0 ? 'auto' : 0 }}
            disabled={!canNext()}
            onClick={handleNext}
          >
            {step === STEPS.length - 2 ? 'Envoyer le rapport' : 'Suivant →'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: ${G.dark}; }
        input, textarea, button { font-family: 'DM Sans', sans-serif; }
        textarea { resize: none; }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: G.gold,
        marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const s = {
  page: {
    minHeight: '100dvh',
    background: G.paper,
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 600,
    margin: '0 auto',
  },
  header: {
    background: G.dark,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {},
  logo: {
    fontFamily: "'Bodoni Moda', serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.04em',
  },
  logoSub: {
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  progressWrap: {
    background: G.dark,
    padding: '0 20px 16px',
  },
  progressBar: {
    height: 2,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    background: G.gold,
    transition: 'width 0.3s ease',
  },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    padding: '24px 20px',
    overflowY: 'auto',
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    background: G.white,
    border: `0.5px solid rgba(184,151,90,0.3)`,
    borderRadius: 4,
    fontSize: 15,
    color: G.ink,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '13px 14px',
    background: G.white,
    border: `0.5px solid rgba(184,151,90,0.3)`,
    borderRadius: 4,
    fontSize: 15,
    color: G.ink,
    outline: 'none',
    lineHeight: 1.6,
  },
  timeRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'stretch',
  },
  nowBtn: {
    padding: '0 16px',
    background: G.dark,
    border: 'none',
    color: G.gold,
    fontSize: 13,
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  selectedAff: {
    background: G.white,
    border: `1.5px solid ${G.gold}`,
    borderRadius: 4,
    padding: '14px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectedAffLabel: {
    fontSize: 13,
    color: G.ink,
    lineHeight: 1.4,
    flex: 1,
  },
  changeBtn: {
    background: 'transparent',
    border: `1px solid ${G.gold}`,
    color: G.gold,
    fontSize: 11,
    padding: '6px 12px',
    borderRadius: 2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    letterSpacing: '0.06em',
  },
  affList: {
    maxHeight: 320,
    overflowY: 'auto',
    border: `0.5px solid rgba(184,151,90,0.25)`,
    borderRadius: 4,
    background: G.white,
  },
  affItem: {
    width: '100%',
    padding: '14px 14px',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderBottom: `0.5px solid rgba(184,151,90,0.15)`,
    cursor: 'pointer',
    display: 'block',
  },
  affNum: {
    fontSize: 11,
    fontWeight: 600,
    color: G.gold,
    letterSpacing: '0.1em',
    marginBottom: 3,
  },
  affDesc: {
    fontSize: 14,
    color: G.ink,
    marginBottom: 2,
  },
  affContact: {
    fontSize: 12,
    color: 'rgba(26,26,24,0.5)',
  },
  hint: {
    fontSize: 13,
    color: 'rgba(26,26,24,0.4)',
    padding: '12px 14px',
    fontStyle: 'italic',
  },
  sigWrap: {
    background: G.white,
    border: `0.5px solid rgba(184,151,90,0.3)`,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  clearSig: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    background: 'rgba(17,17,16,0.08)',
    border: 'none',
    borderRadius: 2,
    padding: '4px 10px',
    fontSize: 11,
    color: G.soft,
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  nav: {
    padding: '16px 20px',
    background: G.white,
    borderTop: `0.5px solid rgba(184,151,90,0.2)`,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  backBtn: {
    padding: '14px 20px',
    background: 'transparent',
    border: `0.5px solid rgba(26,26,24,0.2)`,
    borderRadius: 4,
    fontSize: 14,
    color: G.soft,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  nextBtn: {
    flex: 1,
    padding: '16px',
    background: G.dark,
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 500,
    color: G.gold,
    cursor: 'pointer',
    letterSpacing: '0.06em',
    transition: 'opacity 0.2s',
  },
  sendSpinner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: `3px solid rgba(184,151,90,0.2)`,
    borderTopColor: G.gold,
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  sendLabel: {
    fontSize: 14,
    color: 'rgba(26,26,24,0.5)',
    letterSpacing: '0.06em',
  },
  retryBtn: {
    padding: '14px 32px',
    background: G.dark,
    border: 'none',
    borderRadius: 4,
    color: G.gold,
    fontSize: 14,
    cursor: 'pointer',
  },
}

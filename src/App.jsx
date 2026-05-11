import { G } from './utils/colors.js'
import { useState, useEffect } from 'react'
import PinScreen from './components/PinScreen.jsx'
import InterventionForm from './components/InterventionForm.jsx'



export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('fr_token'))
  const [done, setDone] = useState(false)
  const [lastReport, setLastReport] = useState(null)

  const handleAuth = (t) => {
    sessionStorage.setItem('fr_token', t)
    setToken(t)
  }

  const handleDone = (report) => {
    setLastReport(report || null)
    setDone(true)
  }

  if (done) {
    return (
      <div style={styles.page}>
        <div style={styles.successWrap}>
          <div style={styles.successIcon}>✓</div>
          <div style={styles.successTitle}>Rapport enregistré</div>
          <div style={styles.successSub}>Le PDF est disponible dans le dossier Drive de l'affaire.</div>
          {lastReport?.fileUrl && (
            <a style={styles.linkBtn} href={lastReport.fileUrl} target="_blank" rel="noreferrer">
              Ouvrir le rapport
            </a>
          )}
          {lastReport?.folderUrl && (
            <a style={styles.linkBtn} href={lastReport.folderUrl} target="_blank" rel="noreferrer">
              Ouvrir le dossier affaire
            </a>
          )}
          <button
            style={styles.newBtn}
            onClick={() => { setDone(false); setLastReport(null) }}
          >
            Nouveau rapport
          </button>
        </div>
      </div>
    )
  }

  if (!token) return <PinScreen onAuth={handleAuth} />
  return <InterventionForm token={token} onDone={handleDone} onLogout={() => { sessionStorage.removeItem('fr_token'); setToken(null) }} />
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: G.dark,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'DM Sans', sans-serif",
  },
  successWrap: {
    textAlign: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    border: `2px solid ${G.gold}`,
    color: G.gold,
    fontSize: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  successTitle: {
    fontFamily: "'Bodoni Moda', serif",
    fontSize: 28,
    color: G.white,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 40,
  },
  newBtn: {
    background: 'transparent',
    border: `1px solid ${G.gold}`,
    color: G.gold,
    padding: '14px 32px',
    fontSize: 14,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    borderRadius: 2,
  },
  linkBtn: {
    display: 'block',
    width: '100%',
    maxWidth: 280,
    margin: '0 auto 12px',
    background: G.gold,
    border: `1px solid ${G.gold}`,
    color: G.dark,
    padding: '14px 20px',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textDecoration: 'none',
    borderRadius: 2,
  },
}

import { useState, useEffect } from 'react'
import PinScreen from './components/PinScreen.jsx'
import InterventionForm from './components/InterventionForm.jsx'

const G = {
  dark: '#111110',
  gold: '#b8975a',
  paper: '#f7f5f0',
  white: '#ffffff',
  ink: '#1a1a18',
  soft: 'rgba(26,26,24,0.5)',
  border: 'rgba(184,151,90,0.25)',
}

export { G }

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('fr_token'))
  const [done, setDone] = useState(false)

  const handleAuth = (t) => {
    sessionStorage.setItem('fr_token', t)
    setToken(t)
  }

  const handleDone = () => setDone(true)

  if (done) {
    return (
      <div style={styles.page}>
        <div style={styles.successWrap}>
          <div style={styles.successIcon}>✓</div>
          <div style={styles.successTitle}>Rapport envoyé</div>
          <div style={styles.successSub}>Le brouillon email a été créé dans Gmail.</div>
          <button
            style={styles.newBtn}
            onClick={() => setDone(false)}
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
}

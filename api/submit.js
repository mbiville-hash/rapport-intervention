const { verifyToken } = require('./_verify')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!verifyToken(token)) return res.status(401).json({ error: 'Non autorisé' })

  const response = await fetch(process.env.WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  })

  if (!response.ok) return res.status(502).json({ error: 'Erreur Make' })
  res.status(200).json({ success: true })
}

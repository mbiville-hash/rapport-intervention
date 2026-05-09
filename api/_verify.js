import crypto from 'crypto'

export function verifyToken(token) {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expires, signature] = parts
  if (Date.now() > parseInt(expires)) return false
  const expected = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
    .update(expires)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

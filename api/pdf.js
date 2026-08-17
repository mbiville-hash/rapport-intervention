import { verifyToken } from './_verify.js'
import { renderReport, reportFilename } from '../lib/pdf/render.js'

/**
 * Fabrique le PDF du rapport d'intervention.
 *
 * Remplace l'ancien appel a PDF.co : la mise en page est calculee ici, sans
 * service externe ni navigateur sans tete.
 *
 * Authentification, au choix :
 *   - en-tete `x-fortis-secret` (ou `?secret=`) egal a PDF_SECRET / WEBHOOK_SECRET
 *   - en-tete `Authorization: Bearer <jeton de session du formulaire>`
 *
 * Corps : la charge utile du formulaire, plus deux champs facultatifs
 *   - `drive_token` : jeton OAuth Google permettant de lire les photos par
 *     `fileId` sans les faire transiter en base64
 *   - `format` : `base64` pour recevoir du JSON plutot que le binaire
 *
 * Reponse : le PDF binaire (`application/pdf`), ou du JSON si `format=base64`.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Methode non autorisee' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Non autorise' })
  }

  const payload = req.body || {}
  const missing = ['client', 'adresse', 'date', 'technicien'].filter((field) => !payload[field])
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Champs manquants : ${missing.join(', ')}` })
  }

  try {
    const { bytes, warnings } = await renderReport(payload, {
      driveToken: payload.drive_token || req.headers['x-drive-token'] || '',
    })
    const filename = reportFilename(payload)

    if (payload.format === 'base64' || req.query?.format === 'base64') {
      return res.status(200).json({
        ok: true,
        filename,
        warnings,
        pdf_base64: Buffer.from(bytes).toString('base64'),
      })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    if (warnings.length) res.setHeader('x-fortis-warnings', encodeURIComponent(warnings.join(' | ')))
    return res.status(200).send(Buffer.from(bytes))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ ok: false, error: `Generation du PDF impossible : ${error.message}` })
  }
}

function isAuthorized(req) {
  const expected = process.env.PDF_SECRET || process.env.WEBHOOK_SECRET
  if (expected) {
    const provided = req.headers['x-fortis-secret'] || req.query?.secret || req.body?.pdf_secret
    if (provided && timingSafeEqual(String(provided), expected)) return true
  }

  const token = String(req.headers.authorization || '').replace('Bearer ', '')
  if (token && verifyToken(token)) return true

  // Sans secret configure, seule la session du formulaire fait foi.
  return false
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

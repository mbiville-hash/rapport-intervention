/**
 * Recuperation et embarquement des images (photos de chantier, signatures).
 *
 * Les photos vivent dans Drive : Apps Script nous transmet leur `fileId` avec un
 * jeton OAuth de courte duree, ce qui evite de faire transiter plusieurs Mo de
 * base64 dans le corps de la requete. Les autres formes (data URL, URL publique)
 * restent acceptees pour pouvoir tester l'endpoint sans Drive.
 */

const MAX_IMAGES = 40
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15000

function decodeBase64(value) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value)
  if (!match) return Buffer.from(value, 'base64')
  return match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'binary')
}

function driveFileId(value) {
  if (!value) return ''
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/]
  for (const pattern of patterns) {
    const match = pattern.exec(String(value))
    if (match) return match[1]
  }
  return ''
}

async function fetchBytes(url, headers) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { headers, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

/** Ramene une entree de photo (quelle que soit sa forme) a un Buffer. */
async function resolveBytes(source, driveToken) {
  if (!source) return null

  if (Buffer.isBuffer(source)) return source

  if (typeof source === 'string') {
    if (source.startsWith('data:')) return decodeBase64(source)
    return resolveBytes({ url: source }, driveToken)
  }

  const inline = source.data || source.data_url || source.dataUrl || source.base64
  if (inline) return decodeBase64(inline)

  const fileId = source.fileId || source.file_id || driveFileId(source.url)
  if (fileId && driveToken) {
    return fetchBytes(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      Authorization: `Bearer ${driveToken}`,
    })
  }

  if (source.url && /^https?:/i.test(source.url)) {
    if (fileId) {
      // Sans jeton, seul le lien de telechargement direct a une chance d'aboutir
      // (et uniquement si le fichier est partage publiquement).
      return fetchBytes(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`)
    }
    return fetchBytes(source.url)
  }

  return null
}

function detectFormat(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  return null
}

/**
 * Charge toutes les images demandees et les embarque dans le document.
 * Une image illisible est ignoree (et signalee) plutot que de faire echouer
 * l'ensemble du rapport.
 */
export async function embedImages(pdfDoc, sources, { driveToken, warnings = [] } = {}) {
  const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean).slice(0, MAX_IMAGES)
  const results = []
  let total = 0

  for (const source of list) {
    let bytes
    try {
      bytes = await resolveBytes(source, driveToken)
    } catch (error) {
      warnings.push(`Image ignoree (${error.message})`)
      continue
    }

    if (!bytes || !bytes.length) {
      warnings.push('Image ignoree (source vide ou non exploitable)')
      continue
    }

    total += bytes.length
    if (total > MAX_TOTAL_BYTES) {
      warnings.push('Images suivantes ignorees : volume total trop important')
      break
    }

    const format = detectFormat(bytes)
    if (!format) {
      warnings.push('Image ignoree (format non supporte, seuls JPEG et PNG le sont)')
      continue
    }

    try {
      const embedded = format === 'jpg' ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes)
      results.push(embedded)
    } catch (error) {
      warnings.push(`Image ignoree (${error.message})`)
    }
  }

  return results
}

/** Charge une image unique (signature). Renvoie `null` si indisponible. */
export async function embedImage(pdfDoc, source, options) {
  const [image] = await embedImages(pdfDoc, source ? [source] : [], options)
  return image || null
}

/** Dimensions d'une image inscrite dans une boite, facon `object-fit: contain`. */
export function containSize(image, boxWidth, boxHeight) {
  const ratio = Math.min(boxWidth / image.width, boxHeight / image.height)
  return { width: image.width * ratio, height: image.height * ratio }
}

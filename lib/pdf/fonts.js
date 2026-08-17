import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FILES = {
  regular: 'Montserrat-Regular.ttf',
  medium: 'Montserrat-Medium.ttf',
  semibold: 'Montserrat-SemiBold.ttf',
  bold: 'Montserrat-Bold.ttf',
  serif: 'BodoniModa-Regular.ttf',
  serifBold: 'BodoniModa-Bold.ttf',
}

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vercel n'expose pas toujours le meme cwd selon le runtime, et le tracing de
 * fichiers ne suit pas les chemins construits dynamiquement : on tente donc
 * plusieurs racines avant d'abandonner.
 */
const ROOTS = [
  path.join(here, '..', '..', 'assets', 'fonts'),
  path.join(process.cwd(), 'assets', 'fonts'),
  path.join(process.cwd(), '..', 'assets', 'fonts'),
]

let cache = null

async function readFont(filename) {
  const attempts = []
  for (const root of ROOTS) {
    const candidate = path.join(root, filename)
    try {
      return await readFile(candidate)
    } catch (error) {
      attempts.push(`${candidate} (${error.code || error.message})`)
    }
  }
  throw new Error(`Police introuvable : ${filename}. Chemins testes : ${attempts.join(', ')}`)
}

/** Charge les 6 fichiers de police une seule fois par instance lambda. */
export async function loadFontBytes() {
  if (!cache) {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, filename]) => [key, await readFont(filename)])
    )
    cache = Object.fromEntries(entries)
  }
  return cache
}

/** Embarque les polices dans le document, en sous-ensemble pour limiter le poids. */
export async function embedFonts(pdfDoc) {
  const bytes = await loadFontBytes()
  const embedded = {}
  for (const [key, data] of Object.entries(bytes)) {
    embedded[key] = await pdfDoc.embedFont(data, { subset: true })
  }
  return embedded
}

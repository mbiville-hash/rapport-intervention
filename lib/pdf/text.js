import { PAGE } from './theme.js'

/**
 * Helpers typographiques : mesure, cesure et rendu avec interlettrage.
 *
 * pdf-lib dessine du texte a partir d'une ligne de base, alors que le template
 * d'origine raisonne en boites CSS. Les fonctions ci-dessous font la
 * conversion, y compris le `letter-spacing` que pdf-lib ne gere pas nativement.
 */

function metrics(font) {
  const inner = font.embedder && font.embedder.font
  const upem = (inner && inner.unitsPerEm) || 1000
  const ascent = (inner && inner.ascent) || 0.8 * upem
  const descent = (inner && inner.descent) || -0.2 * upem
  return { ascent: ascent / upem, descent: descent / upem }
}

/** Decalage de la ligne de base depuis le haut d'une boite de ligne CSS. */
export function baselineOffset(font, size, lineHeight) {
  const { ascent, descent } = metrics(font)
  const content = (ascent - descent) * size
  return (lineHeight - content) / 2 + ascent * size
}

/**
 * Largeur d'un texte, interlettrage compris. Comme en CSS, l'espacement est
 * ajoute apres chaque caractere, y compris le dernier.
 */
export function measure(font, text, size, tracking = 0) {
  if (!text) return 0
  const base = font.widthOfTextAtSize(text, size)
  return base + tracking * size * [...text].length
}

/**
 * Remplace les caracteres absents de la police pour eviter que pdf-lib ne jette
 * une erreur en plein rendu a cause d'un emoji ou d'un caractere exotique saisi
 * depuis un telephone.
 */
export function sanitize(font, text) {
  const inner = font.embedder && font.embedder.font
  const value = String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/[\t\v\f]/g, ' ')
  if (!inner || typeof inner.hasGlyphForCodePoint !== 'function') return value
  let out = ''
  for (const char of value) {
    if (char === '\n') {
      out += char
      continue
    }
    out += inner.hasGlyphForCodePoint(char.codePointAt(0)) ? char : '?'
  }
  return out
}

/** Decoupe un texte en lignes tenant dans `width`, en respectant les sauts de ligne. */
export function wrap(font, text, size, width, tracking = 0) {
  const value = sanitize(font, text)
  if (!value.trim()) return []

  const lines = []
  for (const paragraph of value.split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }

    let current = ''
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (measure(font, candidate, size, tracking) <= width || !current) {
        current = candidate
        continue
      }
      lines.push(current)
      current = word
    }
    if (current) lines.push(current)
  }

  // Un mot unique plus large que la colonne (URL, reference produit) doit etre
  // coupe de force, sinon il deborde de sa boite.
  const result = []
  for (const line of lines) {
    if (measure(font, line, size, tracking) <= width) {
      result.push(line)
      continue
    }
    let buffer = ''
    for (const char of line) {
      if (buffer && measure(font, buffer + char, size, tracking) > width) {
        result.push(buffer)
        buffer = char
      } else {
        buffer += char
      }
    }
    if (buffer) result.push(buffer)
  }
  return result
}

/**
 * Dessine un texte a partir du coin haut-gauche de sa boite de ligne.
 *
 * `top` est exprime comme partout dans le moteur : une distance depuis le haut
 * de la page, convertie ici vers le repere bas-gauche de PDF.
 * `align` accepte 'left' ou 'right'.
 */
export function drawText(page, text, options) {
  const {
    font,
    size,
    x,
    top,
    lineHeight = size,
    tracking = 0,
    color,
    opacity = 1,
    align = 'left',
    maxWidth,
  } = options

  const value = sanitize(font, text)
  if (!value) return

  const width = measure(font, value, size, tracking)
  let cursor = align === 'right' ? x - width : x
  if (align === 'right' && maxWidth) cursor = x + maxWidth - width

  const y = PAGE.height - top - baselineOffset(font, size, lineHeight)

  if (!tracking) {
    page.drawText(value, { x: cursor, y, size, font, color, opacity })
    return
  }

  for (const char of value) {
    page.drawText(char, { x: cursor, y, size, font, color, opacity })
    cursor += font.widthOfTextAtSize(char, size) + tracking * size
  }
}

/** Dessine une suite de lignes deja calculees par `wrap`. */
export function drawLines(page, lines, options) {
  const { top, lineHeight } = options
  lines.forEach((line, index) => {
    if (!line) return
    drawText(page, line, { ...options, top: top + index * lineHeight })
  })
}

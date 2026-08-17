import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

import { ALPHA, BRAND, COLORS, CSS, FOOTER_TEXT, MARGIN, PAGE, px } from './theme.js'
import { embedFonts } from './fonts.js'
import { containSize, embedImage, embedImages } from './images.js'
import { drawLines, drawText, measure, wrap } from './text.js'

const HEADER_HEIGHT = px(CSS.header.paddingY * 2 + CSS.logoName.fontSize * CSS.body.lineHeight + CSS.logoSub.marginTop + CSS.logoSub.fontSize * CSS.body.lineHeight)
const FOOTER_HEIGHT = px(CSS.footer.paddingY * 2 + CSS.footer.fontSize * CSS.body.lineHeight)
const GOLD_BAR = px(CSS.goldBar)

const CONTENT_LEFT = MARGIN
const CONTENT_WIDTH = PAGE.width - MARGIN * 2
const BODY_LEFT = CONTENT_LEFT + px(CSS.body.paddingX)
const BODY_WIDTH = CONTENT_WIDTH - px(CSS.body.paddingX) * 2

/**
 * Moteur de mise en page en flux vertical.
 *
 * Les coordonnees sont exprimees en « distance depuis le haut de la page »,
 * bien plus lisible que le repere bas-gauche de PDF, et converties au moment de
 * dessiner.
 */
class Renderer {
  constructor(pdfDoc, fonts) {
    this.pdfDoc = pdfDoc
    this.fonts = fonts
    this.page = null
    this.top = 0
    this.pageCount = 0
  }

  get bottomLimit() {
    return PAGE.height - MARGIN - FOOTER_HEIGHT - px(CSS.body.paddingBottom)
  }

  get remaining() {
    return this.bottomLimit - this.top
  }

  y(top) {
    return PAGE.height - top
  }

  rect(top, height, options) {
    this.page.drawRectangle({ x: options.x, y: this.y(top + height), width: options.width, height, ...options })
  }

  newPage() {
    this.page = this.pdfDoc.addPage([PAGE.width, PAGE.height])
    this.pageCount += 1

    this.page.drawRectangle({
      x: CONTENT_LEFT,
      y: MARGIN,
      width: CONTENT_WIDTH,
      height: PAGE.height - MARGIN * 2,
      color: COLORS.paper,
    })

    this.top = MARGIN
    if (this.pageCount === 1) this.drawHeader()
    this.drawFooter()
    this.top += px(CSS.body.paddingTop)
  }

  /** Passe a une nouvelle page si le bloc ne tient pas. Renvoie true si saut. */
  ensure(height) {
    if (this.page && this.remaining >= height) return false
    this.newPage()
    return true
  }

  drawHeader() {
    const { fonts } = this
    this.rect(this.top, HEADER_HEIGHT, { x: CONTENT_LEFT, width: CONTENT_WIDTH, color: COLORS.dark })

    const left = CONTENT_LEFT + px(CSS.header.paddingX)
    const right = CONTENT_LEFT + CONTENT_WIDTH - px(CSS.header.paddingX)
    const nameSize = px(CSS.logoName.fontSize)
    const nameLine = px(CSS.logoName.fontSize * CSS.body.lineHeight)
    let cursor = this.top + px(CSS.header.paddingY)

    drawText(this.page, BRAND.name, {
      font: fonts.serifBold,
      size: nameSize,
      x: left,
      top: cursor,
      lineHeight: nameLine,
      tracking: CSS.logoName.tracking,
      color: COLORS.white,
    })
    drawText(this.page, '.', {
      font: fonts.serifBold,
      size: nameSize,
      x: left + measure(fonts.serifBold, BRAND.name, nameSize, CSS.logoName.tracking),
      top: cursor,
      lineHeight: nameLine,
      color: COLORS.gold,
    })

    cursor += nameLine + px(CSS.logoSub.marginTop)
    drawText(this.page, BRAND.tagline.toUpperCase(), {
      font: fonts.semibold,
      size: px(CSS.logoSub.fontSize),
      x: left,
      top: cursor,
      lineHeight: px(CSS.logoSub.fontSize * CSS.body.lineHeight),
      tracking: CSS.logoSub.tracking,
      color: COLORS.white,
      opacity: ALPHA.logoSub,
    })

    const rightBlock =
      px(CSS.docTitle.fontSize * CSS.body.lineHeight) + px(CSS.docRef.marginTop) + px(CSS.docRef.fontSize * CSS.body.lineHeight)
    let rightCursor = this.top + (HEADER_HEIGHT - rightBlock) / 2

    drawText(this.page, BRAND.docTitle.toUpperCase(), {
      font: fonts.serif,
      size: px(CSS.docTitle.fontSize),
      x: right,
      top: rightCursor,
      lineHeight: px(CSS.docTitle.fontSize * CSS.body.lineHeight),
      tracking: CSS.docTitle.tracking,
      color: COLORS.gold,
      align: 'right',
    })

    rightCursor += px(CSS.docTitle.fontSize * CSS.body.lineHeight) + px(CSS.docRef.marginTop)
    drawText(this.page, this.reference, {
      font: fonts.regular,
      size: px(CSS.docRef.fontSize),
      x: right,
      top: rightCursor,
      lineHeight: px(CSS.docRef.fontSize * CSS.body.lineHeight),
      tracking: CSS.docRef.tracking,
      color: COLORS.white,
      opacity: ALPHA.docRef,
      align: 'right',
    })

    this.top += HEADER_HEIGHT
    this.rect(this.top, GOLD_BAR, { x: CONTENT_LEFT, width: CONTENT_WIDTH, color: COLORS.gold })
    this.top += GOLD_BAR
  }

  drawFooter() {
    const top = PAGE.height - MARGIN - FOOTER_HEIGHT
    this.rect(top, FOOTER_HEIGHT, { x: CONTENT_LEFT, width: CONTENT_WIDTH, color: COLORS.dark })

    const size = px(CSS.footer.fontSize)
    const lineHeight = px(CSS.footer.fontSize * CSS.body.lineHeight)
    const textTop = top + px(CSS.footer.paddingY)

    drawText(this.page, FOOTER_TEXT.left, {
      font: this.fonts.regular,
      size,
      x: CONTENT_LEFT + px(CSS.footer.paddingX),
      top: textTop,
      lineHeight,
      tracking: CSS.footerLeft.tracking,
      color: COLORS.white,
      opacity: ALPHA.footerLeft,
    })

    drawText(this.page, FOOTER_TEXT.right, {
      font: this.fonts.regular,
      size,
      x: CONTENT_LEFT + CONTENT_WIDTH - px(CSS.footer.paddingX),
      top: textTop,
      lineHeight,
      tracking: CSS.footerRight.tracking,
      color: COLORS.gold,
      align: 'right',
    })
  }

  line(top, x, width, { color = COLORS.gold, opacity = ALPHA.goldBorder, thickness = px(0.5) } = {}) {
    this.page.drawRectangle({ x, y: this.y(top + thickness), width, height: thickness, color, opacity })
  }
}

/* ------------------------------------------------------------------ */
/* Blocs                                                               */
/* ------------------------------------------------------------------ */

function metaBlock(renderer, cells) {
  const { fonts } = renderer
  const border = px(CSS.meta.border)
  const columnWidth = CONTENT_WIDTH / 2
  const innerWidth = columnWidth - px(CSS.meta.paddingX) * 2
  const labelSize = px(CSS.metaLabel.fontSize)
  const labelLine = px(CSS.metaLabel.fontSize * CSS.body.lineHeight)
  const valueSize = px(CSS.metaValue.fontSize)
  const valueLine = px(CSS.metaValue.fontSize * CSS.body.lineHeight)

  const prepared = cells.map((cell) => {
    const lines = wrap(fonts.medium, cell.value || '—', valueSize, innerWidth)
    return {
      label: cell.label.toUpperCase(),
      lines: lines.length ? lines : ['—'],
    }
  })

  const rows = []
  for (let index = 0; index < prepared.length; index += 2) {
    const row = prepared.slice(index, index + 2)
    const height = Math.max(
      ...row.map(
        (cell) =>
          px(CSS.meta.paddingY) * 2 + labelLine + px(CSS.metaLabel.marginBottom) + cell.lines.length * valueLine
      )
    )
    rows.push({ cells: row, height })
  }

  const height = rows.reduce((sum, row) => sum + row.height, 0)
  renderer.ensure(height)

  const top = renderer.top
  rows.forEach((row, rowIndex) => {
    const rowTop = top + rows.slice(0, rowIndex).reduce((sum, item) => sum + item.height, 0)

    row.cells.forEach((cell, columnIndex) => {
      const x = CONTENT_LEFT + columnIndex * columnWidth + px(CSS.meta.paddingX)
      let cursor = rowTop + px(CSS.meta.paddingY)

      drawText(renderer.page, cell.label, {
        font: fonts.bold,
        size: labelSize,
        x,
        top: cursor,
        lineHeight: labelLine,
        tracking: CSS.metaLabel.tracking,
        color: COLORS.gold,
      })

      cursor += labelLine + px(CSS.metaLabel.marginBottom)
      drawLines(renderer.page, cell.lines, {
        font: fonts.medium,
        size: valueSize,
        x,
        top: cursor,
        lineHeight: valueLine,
        color: COLORS.ink,
      })
    })

    if (rowIndex < rows.length - 1) {
      renderer.line(rowTop + row.height, CONTENT_LEFT, CONTENT_WIDTH, { thickness: border })
    }
  })

  // Cadre exterieur + separateur central.
  renderer.line(top, CONTENT_LEFT, CONTENT_WIDTH, { thickness: border })
  renderer.line(top + height, CONTENT_LEFT, CONTENT_WIDTH, { thickness: border })
  renderer.page.drawRectangle({
    x: CONTENT_LEFT,
    y: renderer.y(top + height),
    width: border,
    height,
    color: COLORS.gold,
    opacity: ALPHA.goldBorder,
  })
  renderer.page.drawRectangle({
    x: CONTENT_LEFT + CONTENT_WIDTH - border,
    y: renderer.y(top + height),
    width: border,
    height,
    color: COLORS.gold,
    opacity: ALPHA.goldBorder,
  })
  renderer.page.drawRectangle({
    x: CONTENT_LEFT + columnWidth,
    y: renderer.y(top + height),
    width: border,
    height,
    color: COLORS.gold,
    opacity: ALPHA.goldBorder,
  })

  renderer.top = top + height + px(CSS.meta.marginBottom)
}

function sectionTitleHeight() {
  return (
    px(CSS.sectionTitle.fontSize * CSS.body.lineHeight) +
    px(CSS.sectionTitle.paddingBottom) +
    px(CSS.sectionTitle.border) +
    px(CSS.sectionTitle.marginBottom)
  )
}

function drawSectionTitle(renderer, title) {
  const { fonts } = renderer
  const size = px(CSS.sectionTitle.fontSize)
  const lineHeight = px(CSS.sectionTitle.fontSize * CSS.body.lineHeight)
  const top = renderer.top

  const dashWidth = px(CSS.sectionTitle.dashWidth)
  renderer.page.drawRectangle({
    x: BODY_LEFT,
    y: renderer.y(top + lineHeight / 2),
    width: dashWidth,
    height: px(1),
    color: COLORS.gold,
  })

  drawText(renderer.page, title.toUpperCase(), {
    font: fonts.bold,
    size,
    x: BODY_LEFT + dashWidth + px(CSS.sectionTitle.dashGap),
    top,
    lineHeight,
    tracking: CSS.sectionTitle.tracking,
    color: COLORS.gold,
  })

  renderer.line(top + lineHeight + px(CSS.sectionTitle.paddingBottom), BODY_LEFT, BODY_WIDTH, {
    thickness: px(CSS.sectionTitle.border),
  })

  renderer.top = top + sectionTitleHeight()
}

function drawTextBox(renderer, lines) {
  const lineHeight = px(CSS.sectionText.fontSize * CSS.sectionText.lineHeight)
  const height = px(CSS.sectionText.paddingY) * 2 + lines.length * lineHeight
  const top = renderer.top

  renderer.rect(top, height, { x: BODY_LEFT, width: BODY_WIDTH, color: COLORS.white })
  renderer.rect(top, height, { x: BODY_LEFT, width: px(CSS.sectionText.accent), color: COLORS.gold })

  drawLines(renderer.page, lines, {
    font: renderer.fonts.regular,
    size: px(CSS.sectionText.fontSize),
    x: BODY_LEFT + px(CSS.sectionText.paddingX),
    top: top + px(CSS.sectionText.paddingY),
    lineHeight,
    color: COLORS.ink,
  })

  renderer.top = top + height
}

function textSection(renderer, title, value) {
  const size = px(CSS.sectionText.fontSize)
  const lineHeight = px(CSS.sectionText.fontSize * CSS.sectionText.lineHeight)
  const innerWidth = BODY_WIDTH - px(CSS.sectionText.paddingX) * 2
  const padding = px(CSS.sectionText.paddingY) * 2

  let lines = wrap(renderer.fonts.regular, value, size, innerWidth)
  if (!lines.length) lines = ['—']

  const titleHeight = sectionTitleHeight()
  const fullHeight = titleHeight + padding + lines.length * lineHeight

  // Un titre ne doit jamais rester seul en bas de page : on exige au moins deux
  // lignes de texte avec lui.
  const minimum = titleHeight + padding + Math.min(lines.length, 2) * lineHeight
  renderer.ensure(Math.min(fullHeight, minimum))

  drawSectionTitle(renderer, title)

  let pending = lines
  let first = true
  while (pending.length) {
    if (!first) renderer.ensure(padding + lineHeight)
    const capacity = Math.max(1, Math.floor((renderer.remaining - padding) / lineHeight))
    const chunk = pending.slice(0, capacity)
    drawTextBox(renderer, chunk)
    pending = pending.slice(chunk.length)
    first = false
  }

  renderer.top += px(CSS.section.marginBottom)
}

function photoSection(renderer, title, images) {
  if (!images.length) return

  const gap = px(CSS.photos.gap)
  const columns = CSS.photos.columns
  const cellWidth = (BODY_WIDTH - gap * (columns - 1)) / columns
  const cellHeight = px(CSS.photos.height)
  const border = px(CSS.photos.border)

  const rows = []
  for (let index = 0; index < images.length; index += columns) {
    rows.push(images.slice(index, index + columns))
  }

  renderer.ensure(sectionTitleHeight() + cellHeight)
  drawSectionTitle(renderer, title)

  rows.forEach((row, rowIndex) => {
    const brokePage = rowIndex > 0 ? renderer.ensure(cellHeight + gap) : false
    const top = rowIndex > 0 && !brokePage ? renderer.top + gap : renderer.top

    row.forEach((image, columnIndex) => {
      const x = BODY_LEFT + columnIndex * (cellWidth + gap)
      renderer.rect(top, cellHeight, { x, width: cellWidth, color: COLORS.photoBg })
      renderer.page.drawRectangle({
        x,
        y: renderer.y(top + cellHeight),
        width: cellWidth,
        height: cellHeight,
        borderColor: COLORS.gold,
        borderOpacity: ALPHA.goldBorder,
        borderWidth: border,
      })

      const size = containSize(image, cellWidth, cellHeight)
      renderer.page.drawImage(image, {
        x: x + (cellWidth - size.width) / 2,
        y: renderer.y(top + (cellHeight + size.height) / 2),
        width: size.width,
        height: size.height,
      })
    })

    renderer.top = top + cellHeight
  })

  renderer.top += px(CSS.section.marginBottom)
}

function signatureBlock(renderer, entries) {
  const { fonts } = renderer
  const gap = px(CSS.signRow.gap)
  const boxWidth = (BODY_WIDTH - gap) / 2
  const labelLine = px(CSS.signLabel.fontSize * CSS.body.lineHeight)
  const nameLine = px(CSS.signName.fontSize * CSS.body.lineHeight)
  const height =
    px(CSS.signBox.paddingY) * 2 +
    labelLine +
    px(CSS.signLabel.marginBottom) +
    px(CSS.signArea.height) +
    px(CSS.signArea.marginBottom) +
    nameLine

  renderer.ensure(height + px(CSS.signRow.marginTop))
  const top = renderer.top + px(CSS.signRow.marginTop)

  entries.forEach((entry, index) => {
    const x = BODY_LEFT + index * (boxWidth + gap)

    renderer.rect(top, height, { x, width: boxWidth, color: COLORS.white })
    renderer.page.drawRectangle({
      x,
      y: renderer.y(top + height),
      width: boxWidth,
      height,
      borderColor: COLORS.gold,
      borderOpacity: ALPHA.goldBorder,
      borderWidth: px(CSS.signBox.border),
    })

    let cursor = top + px(CSS.signBox.paddingY)
    drawText(renderer.page, entry.label.toUpperCase(), {
      font: fonts.semibold,
      size: px(CSS.signLabel.fontSize),
      x: x + px(CSS.signBox.paddingX),
      top: cursor,
      lineHeight: labelLine,
      tracking: CSS.signLabel.tracking,
      color: COLORS.gold,
    })

    cursor += labelLine + px(CSS.signLabel.marginBottom)
    const areaHeight = px(CSS.signArea.height)
    const areaWidth = boxWidth - px(CSS.signBox.paddingX) * 2

    if (entry.image) {
      const size = containSize(entry.image, areaWidth, px(CSS.signArea.imageMaxHeight))
      renderer.page.drawImage(entry.image, {
        x: x + px(CSS.signBox.paddingX) + (areaWidth - size.width) / 2,
        y: renderer.y(top + px(CSS.signBox.paddingY) + labelLine + px(CSS.signLabel.marginBottom) + (areaHeight + size.height) / 2),
        width: size.width,
        height: size.height,
      })
    }

    renderer.line(cursor + areaHeight, x + px(CSS.signBox.paddingX), areaWidth, {
      color: COLORS.ink,
      opacity: ALPHA.inkFaint,
      thickness: px(CSS.signArea.border),
    })

    cursor += areaHeight + px(CSS.signArea.marginBottom)
    drawText(renderer.page, entry.name || '', {
      font: fonts.regular,
      size: px(CSS.signName.fontSize),
      x: x + px(CSS.signBox.paddingX),
      top: cursor,
      lineHeight: nameLine,
      color: COLORS.ink,
      opacity: ALPHA.inkSoft,
    })
  })

  renderer.top = top + height
}

/* ------------------------------------------------------------------ */
/* Point d'entree                                                      */
/* ------------------------------------------------------------------ */

function buildMetaCells(data) {
  const cells = []
  if (data.reference_libre) cells.push({ label: 'Référence', value: data.reference_libre })
  cells.push({ label: 'Client', value: data.client })
  cells.push({ label: 'Date', value: data.date })
  cells.push({ label: 'Adresse', value: data.adresse })
  cells.push({ label: 'Technicien', value: data.technicien })
  cells.push({ label: "Heure d'arrivée", value: data.heure_arrivee })
  cells.push({ label: 'Heure de départ', value: data.heure_depart })
  return cells
}

/**
 * Fabrique le PDF du rapport d'intervention.
 *
 * @param {object} data charge utile envoyee par le formulaire
 * @param {object} [options]
 * @param {string} [options.driveToken] jeton OAuth Google pour lire les photos
 * @returns {Promise<{bytes: Uint8Array, warnings: string[]}>}
 */
export async function renderReport(data, options = {}) {
  const warnings = []
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const fonts = await embedFonts(pdfDoc)
  const imageOptions = { driveToken: options.driveToken, warnings }

  const [photosAvant, photosApres, signatureTechnicien, signatureClient] = await Promise.all([
    embedImages(pdfDoc, data.photos_avant, imageOptions),
    embedImages(pdfDoc, data.photos_apres, imageOptions),
    embedImage(pdfDoc, data.signature_technicien, imageOptions),
    embedImage(pdfDoc, data.signature_client, imageOptions),
  ])

  const renderer = new Renderer(pdfDoc, fonts)
  renderer.reference = `Réf. ${data.numero_affaire || data.reference_libre || 'sans affaire'}`

  pdfDoc.setTitle(`Rapport d'intervention — ${data.numero_affaire || data.reference_libre || data.client || ''}`.trim())
  pdfDoc.setAuthor('Fortis Rénovation')
  pdfDoc.setCreator('Fortis Rénovation — Rapport d’intervention')
  pdfDoc.setProducer('Fortis Rénovation')

  renderer.newPage()

  metaBlock(renderer, buildMetaCells(data))

  if (data.equipement) textSection(renderer, 'Équipement concerné', data.equipement)
  if (data.diagnostic) textSection(renderer, 'Constat initial', data.diagnostic)
  photoSection(renderer, 'Photos du constat', photosAvant)
  if (data.travaux) textSection(renderer, 'Intervention réalisée', data.travaux)
  if (data.materiel_utilise) textSection(renderer, 'Matériel utilisé', data.materiel_utilise)
  photoSection(renderer, 'Photos après intervention', photosApres)
  textSection(renderer, 'Modifications / observations finales', data.observations || 'Aucune observation.')

  signatureBlock(renderer, [
    { label: 'Signature technicien', name: data.technicien, image: signatureTechnicien },
    { label: 'Signature client', name: data.nom_signataire || data.client, image: signatureClient },
  ])

  const bytes = await pdfDoc.save()
  return { bytes, warnings }
}

/** Nom de fichier utilise par Apps Script pour deposer le rapport dans Drive. */
export function reportFilename(data) {
  const reference = data.numero_affaire || 'sans-affaire'
  const date = String(data.date || '').replace(/\//g, '-')
  return `Rapport-${reference}-${date}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
}

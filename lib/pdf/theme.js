import { rgb } from 'pdf-lib'

export const MM = 72 / 25.4

export const PAGE = { width: 210 * MM, height: 297 * MM }
export const MARGIN = 10 * MM

/**
 * L'ancienne chaine PDF.co rendait un document large de 210mm dans une page A4
 * pourvue de marges de 10mm : chaque pixel CSS du template historique se
 * retrouvait donc reduit de 190/210. On rejoue exactement le meme facteur pour
 * que le rendu reste superposable aux rapports deja envoyes aux clients.
 */
export const PX = 0.75 * (190 / 210)

export const px = (value) => value * PX

export const COLORS = {
  dark: rgb(0x11 / 255, 0x11 / 255, 0x10 / 255),
  gold: rgb(0xb8 / 255, 0x97 / 255, 0x5a / 255),
  paper: rgb(0xf7 / 255, 0xf5 / 255, 0xf0 / 255),
  white: rgb(1, 1, 1),
  ink: rgb(0x1a / 255, 0x1a / 255, 0x18 / 255),
  photoBg: rgb(0xe8 / 255, 0xe5 / 255, 0xdf / 255),
}

export const ALPHA = {
  goldBorder: 0.3,
  inkSoft: 0.55,
  inkFaint: 0.25,
  footerLeft: 0.35,
  logoSub: 0.45,
  docRef: 0.35,
}

/** Metriques du template, exprimees en pixels CSS d'origine. */
export const CSS = {
  body: { fontSize: 11, lineHeight: 1.55, paddingTop: 28, paddingX: 38, paddingBottom: 36 },
  header: { paddingY: 26, paddingX: 38 },
  logoName: { fontSize: 17, tracking: 0.04 },
  logoSub: { fontSize: 8, tracking: 0.22, marginTop: 5 },
  docTitle: { fontSize: 10, tracking: 0.28 },
  docRef: { fontSize: 9, tracking: 0.12, marginTop: 5 },
  goldBar: 2,
  meta: { paddingY: 10, paddingX: 14, marginBottom: 24, border: 0.5 },
  metaLabel: { fontSize: 7, tracking: 0.18, marginBottom: 3 },
  metaValue: { fontSize: 11 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 8,
    tracking: 0.2,
    dashWidth: 18,
    dashGap: 10,
    paddingBottom: 6,
    marginBottom: 9,
    border: 0.5,
  },
  sectionText: { fontSize: 11, lineHeight: 1.65, paddingY: 10, paddingX: 13, accent: 2 },
  photos: { columns: 3, gap: 8, height: 170, border: 0.5 },
  signRow: { marginTop: 22, gap: 16 },
  signBox: { paddingY: 13, paddingX: 15, border: 0.5 },
  signLabel: { fontSize: 8, tracking: 0.2, marginBottom: 9 },
  signArea: { height: 64, marginBottom: 8, imageMaxHeight: 60, border: 0.5 },
  signName: { fontSize: 10 },
  footer: { paddingY: 13, paddingX: 38, fontSize: 8 },
  footerLeft: { tracking: 0.08 },
  footerRight: { tracking: 0.12 },
}

export const FOOTER_TEXT = {
  left: '193 Rue du Renard · 76000 Rouen · 07 67 49 13 24',
  right: 'fortisrenovation.fr',
}

export const BRAND = {
  name: 'FORTIS RÉNOVATION',
  tagline: 'Maintenance immobilière',
  docTitle: "Rapport d'intervention",
}

#!/usr/bin/env node
/**
 * Genere un PDF de demonstration sans passer par Vercel ni Apps Script.
 *
 *   node scripts/preview-pdf.mjs [sortie.pdf] [payload.json]
 *
 * Sans payload, un rapport d'exemple est utilise. Les photos peuvent etre
 * fournies dans le JSON sous la forme { "data": "<base64 ou data URL>" }.
 */
import { readFile, writeFile } from 'node:fs/promises'

import { renderReport, reportFilename } from '../lib/pdf/render.js'

const SAMPLE = {
  numero_affaire: '',
  reference_libre: 'Débouchage canalisation',
  client: 'Sara Buisson',
  adresse: '144 Bis Rue du Renard, 76000 Rouen, France',
  date: '17/06/2026',
  technicien: 'Marc-Antoine',
  heure_arrivee: '14:38',
  heure_depart: '17:07',
  equipement: 'Ligne commune',
  diagnostic: 'Remontée d’eau dans la SDB à l’utilisation de levier de la cuisine',
  travaux:
    'Coupure d’une ligne en 40 mm afin de passer un furet\nRéparation de la coupure avec Y et bouchon pour permettre un nouvel accès plus tard',
  materiel_utilise: 'Y 40 + bouchon',
  observations: '',
  photos_avant: [],
  photos_apres: [],
  signature_technicien: '',
  signature_client: '',
  nom_signataire: 'Mme Buisson',
}

const [, , output = 'rapport-preview.pdf', payloadPath] = process.argv

const data = payloadPath ? JSON.parse(await readFile(payloadPath, 'utf8')) : SAMPLE

const started = Date.now()
const { bytes, warnings } = await renderReport(data)
await writeFile(output, bytes)

console.log(`${output} — ${(bytes.length / 1024).toFixed(0)} Ko en ${Date.now() - started} ms`)
console.log(`nom de fichier Drive : ${reportFilename(data)}`)
if (warnings.length) console.log('avertissements :', warnings)

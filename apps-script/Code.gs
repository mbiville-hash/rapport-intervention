/**
 * Fortis Renovation — automatisation Apps Script du rapport d'intervention.
 *
 * Le PDF n'est plus fabrique par PDF.co : il est genere par l'endpoint gratuit
 * `/api/pdf` de l'application Vercel. Apps Script conserve ce qu'il fait le
 * mieux — lire Notion, ranger les fichiers dans Drive — et n'a plus aucun
 * abonnement a payer.
 *
 * Proprietes du script a configurer (Parametres du projet > Proprietes) :
 *   NOTION_TOKEN              jeton d'integration Notion
 *   PDF_ENDPOINT              https://intervention.fortisrenovation.fr/api/pdf
 *   PDF_SECRET                meme valeur que la variable PDF_SECRET sur Vercel
 *   WEBHOOK_SECRET            (facultatif) secret partage avec /api/submit
 *   DRIVE_FALLBACK_FOLDER_ID  dossier tampon pour les rapports sans affaire
 *
 * La propriete PDFCO_API_KEY n'est plus utilisee et peut etre supprimee.
 */
const CONFIG = {
  notionVersion: '2022-06-28',
  pdfEndpoint: 'https://intervention.fortisrenovation.fr/api/pdf',
  fallbackDriveFolderId: '12lsSe3SB1_k-ZgE3AyyMe55JSd5_zyDO',
  reportsParentFolderId: '',
  photosFolderName: 'Photos, plans et notes',
};

function doPost(e) {
  try {
    const payload = parseRequest_(e);
    validateWebhookSecret_(e, payload);

    if (payload.action === 'uploadPhoto') {
      return jsonResponse_({ ok: true, photo: uploadPhoto_(payload) });
    }

    const result = processIntervention_(payload);
    return jsonResponse_({
      ok: true,
      fileId: result.file.getId(),
      fileName: result.file.getName(),
      fileUrl: result.file.getUrl(),
      folderId: result.folder.getId(),
      folderUrl: result.folder.getUrl(),
    });
  } catch (error) {
    console.error(error.stack || error);
    return jsonResponse_({ ok: false, error: cleanErrorMessage_(error) }, 500);
  }
}

function testWithExamplePayload() {
  const payload = {
    numero_affaire: 'AFF-002',
    notion_affaire_id: '35892dcce00781e3b655d4ea53db077b',
    client: 'Client Test',
    adresse: 'Adresse Test',
    date: '08/05/2026',
    technicien: 'Marc-Antoine',
    heure_arrivee: '08:30',
    heure_depart: '11:00',
    equipement: 'Regard rouille',
    diagnostic: 'Regard rouille 1800x1000',
    travaux: 'Mise en securite du regard',
    materiel_utilise: 'Barrieres, visserie et consommables',
    observations: '',
    photos_avant: [],
    photos_apres: [],
    signature_technicien: '',
    signature_client: '',
    nom_signataire: 'Client Test',
  };

  return processIntervention_(payload);
}

/**
 * Verifie que l'endpoint Vercel repond, sans rien ecrire dans Drive.
 * A lancer une fois apres le deploiement pour valider la configuration.
 */
function testPdfEndpoint() {
  const blob = createPdfWithFortis_({
    numero_affaire: '',
    reference_libre: 'Test endpoint',
    client: 'Client Test',
    adresse: '193 Rue du Renard, 76000 Rouen',
    date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    technicien: 'Marc-Antoine',
    heure_arrivee: '09:00',
    heure_depart: '10:30',
    equipement: 'Aucun',
    diagnostic: 'Verification de la generation du PDF.',
    travaux: 'Aucun travaux, test technique.',
    observations: '',
    photos_avant: [],
    photos_apres: [],
    nom_signataire: 'Client Test',
  });

  console.log(`PDF genere : ${blob.getBytes().length} octets`);
  return blob;
}

function processIntervention_(payload) {
  validatePayload_(payload);

  const notionToken = getRequiredProperty_('NOTION_TOKEN');
  const affaire = payload.notion_affaire_id ? getNotionPage_(payload.notion_affaire_id, notionToken) : null;
  const reportFolder = resolveAffaireFolder_(payload, affaire, notionToken);

  const pdfBlob = createPdfWithFortis_(payload);
  const filename = sanitizeFilename_(`Rapport-${payload.numero_affaire || 'sans-affaire'}-${isoDateForName_(payload.date)}.pdf`);
  const file = reportFolder.createFile(pdfBlob.setName(filename));

  return { file, folder: reportFolder };
}

/**
 * Demande le PDF a l'application Vercel.
 *
 * Les photos ne sont pas encodees dans la requete : on transmet leurs `fileId`
 * Drive accompagnes d'un jeton OAuth de courte duree, et c'est l'endpoint qui
 * va les telecharger. La requete reste ainsi a quelques kilo-octets, quel que
 * soit le nombre de photos.
 */
function createPdfWithFortis_(payload) {
  const endpoint = PropertiesService.getScriptProperties().getProperty('PDF_ENDPOINT') || CONFIG.pdfEndpoint;
  const secret = PropertiesService.getScriptProperties().getProperty('PDF_SECRET') ||
    PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');

  if (!endpoint) throw new Error('Propriete Apps Script manquante: PDF_ENDPOINT');

  const body = {};
  Object.keys(payload).forEach((key) => {
    if (key !== 'webhook_secret' && key !== 'action') body[key] = payload[key];
  });
  body.photos_avant = normalizePhotos_(payload.photos_avant);
  body.photos_apres = normalizePhotos_(payload.photos_apres);
  body.drive_token = ScriptApp.getOAuthToken();

  const headers = { Accept: 'application/pdf' };
  if (secret) headers['x-fortis-secret'] = secret;

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code >= 300) {
    throw new Error(`Erreur generation PDF (${code}): ${response.getContentText().substring(0, 400)}`);
  }

  const blob = response.getBlob();
  const bytes = blob.getBytes();
  if (bytes.length < 1000 || String.fromCharCode.apply(null, bytes.slice(0, 4)) !== '%PDF') {
    throw new Error(`Reponse inattendue de l endpoint PDF: ${response.getContentText().substring(0, 400)}`);
  }

  const warnings = response.getHeaders()['x-fortis-warnings'] || response.getHeaders()['X-Fortis-Warnings'];
  if (warnings) console.warn(`Avertissements PDF: ${decodeURIComponent(warnings)}`);

  return blob.setContentType('application/pdf');
}

/** Ne garde que ce dont l'endpoint a besoin pour retrouver chaque photo. */
function normalizePhotos_(photos) {
  return normalizeArray_(photos)
    .filter(Boolean)
    .map((photo) => {
      if (typeof photo === 'string') return { url: photo };
      return { fileId: photo.fileId || '', url: photo.url || '', name: photo.name || '' };
    })
    .filter((photo) => photo.fileId || photo.url);
}

function uploadPhoto_(payload) {
  if (!payload || !payload.data_url) throw new Error('Photo manquante.');

  const notionToken = getRequiredProperty_('NOTION_TOKEN');
  const affaire = payload.notion_affaire_id ? getNotionPage_(payload.notion_affaire_id, notionToken) : null;
  const affaireFolder = resolveAffaireFolder_(payload, affaire, notionToken);
  const photoFolder = getOrCreateChildFolder_(affaireFolder, CONFIG.photosFolderName);
  const blob = dataUrlToBlob_(payload.data_url, payload.mime_type || 'image/jpeg');
  const filename = buildPhotoFilename_(payload);
  const file = photoFolder.createFile(blob.setName(filename));

  return {
    fileId: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    category: payload.category || '',
  };
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Requete vide.');
  }

  return JSON.parse(e.postData.contents);
}

function validatePayload_(payload) {
  const required = [
    'client',
    'adresse',
    'date',
    'technicien',
    'heure_arrivee',
    'heure_depart',
  ];

  const missing = required.filter((field) => !payload[field]);
  if (missing.length) {
    throw new Error(`Champs manquants: ${missing.join(', ')}`);
  }

  if (!payload.sans_affaire && !payload.notion_affaire_id) {
    throw new Error('Aucune affaire Notion fournie pour ce rapport.');
  }
}

function validateWebhookSecret_(e, payload) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!expectedSecret) return;

  const querySecret = e && e.parameter && e.parameter.secret;
  const payloadSecret = payload && payload.webhook_secret;
  if (querySecret !== expectedSecret && payloadSecret !== expectedSecret) {
    throw new Error('Secret webhook invalide.');
  }
}

function resolveAffaireFolder_(payload, affairePage, notionToken) {
  const fallbackFolderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FALLBACK_FOLDER_ID') || CONFIG.fallbackDriveFolderId;

  if (!affairePage) {
    return DriveApp.getFolderById(fallbackFolderId);
  }

  const existingFolderId = extractDriveFolderId_(getPropertyText_(affairePage, 'Dossier Drive'));
  if (existingFolderId) {
    return DriveApp.getFolderById(existingFolderId);
  }

  const parentFolderId =
    PropertiesService.getScriptProperties().getProperty('REPORTS_PARENT_FOLDER_ID') ||
    PropertiesService.getScriptProperties().getProperty('DRIVE_PARENT_FOLDER_ID') ||
    PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') ||
    PropertiesService.getScriptProperties().getProperty('DRIVE_DEFAULT_FOLDER_ID') ||
    CONFIG.reportsParentFolderId ||
    fallbackFolderId;

  if (!parentFolderId) {
    throw new Error('Dossier Drive absent dans Notion et dossier parent non configure.');
  }

  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const folder = parentFolder.createFolder(buildAffaireFolderName_(payload, affairePage));
  updateNotionUrlProperty_(payload.notion_affaire_id, 'Dossier Drive', folder.getUrl(), notionToken);
  return folder;
}

function getOrCreateChildFolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function buildPhotoFilename_(payload) {
  const category = payload.category === 'photos_apres' ? 'Apres intervention' : 'Constat';
  const affaire = payload.numero_affaire || 'sans-affaire';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return sanitizeFilename_(`${category} - ${affaire} - ${stamp}.jpg`);
}

function dataUrlToBlob_(dataUrl, fallbackMimeType) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format de photo invalide.');
  const mimeType = match[1] || fallbackMimeType || 'image/jpeg';
  const bytes = Utilities.base64Decode(match[2]);
  return Utilities.newBlob(bytes, mimeType, 'photo.jpg');
}

function getNotionPage_(pageId, token) {
  const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'get',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': CONFIG.notionVersion,
    },
    muteHttpExceptions: true,
  });

  const body = parseJsonResponse_(response, 'Notion');
  if (response.getResponseCode() >= 300) {
    throw new Error(`Erreur Notion ${response.getResponseCode()}: ${body.message || response.getContentText()}`);
  }

  return body;
}

function updateNotionUrlProperty_(pageId, propertyName, url, token) {
  const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'patch',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': CONFIG.notionVersion,
    },
    payload: JSON.stringify({ properties: { [propertyName]: { url } } }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() >= 300) {
    throw new Error(`Erreur Notion ${response.getResponseCode()}: ${response.getContentText()}`);
  }
}

function getPropertyText_(page, propertyName) {
  const property = page.properties && page.properties[propertyName];
  if (!property) return '';

  if (property.email) return property.email;
  if (property.phone_number) return property.phone_number;
  if (property.url) return property.url;
  if (property.select) return property.select.name || '';
  if (property.status) return property.status.name || '';
  if (property.number !== undefined && property.number !== null) return String(property.number);
  if (property.date) return property.date.start || '';
  if (property.checkbox !== undefined) return String(property.checkbox);
  if (property.title) return richTextToPlain_(property.title);
  if (property.rich_text) return richTextToPlain_(property.rich_text);
  if (property.people) return property.people.map((person) => person.name || person.id).join(', ');
  if (property.relation) return property.relation.map((relation) => relation.id).join(', ');
  if (property.formula) return formulaToPlain_(property.formula);
  if (property.rollup) return rollupToPlain_(property.rollup);

  return '';
}

function richTextToPlain_(items) {
  return (items || []).map((item) => item.plain_text || '').join('');
}

function formulaToPlain_(formula) {
  if (!formula) return '';
  if (formula.string !== undefined) return formula.string || '';
  if (formula.number !== undefined && formula.number !== null) return String(formula.number);
  if (formula.boolean !== undefined) return String(formula.boolean);
  if (formula.date) return formula.date.start || '';
  return '';
}

function rollupToPlain_(rollup) {
  if (!rollup) return '';
  if (rollup.array) {
    return rollup.array.map((item) => getPropertyText_({ properties: { value: item } }, 'value')).filter(Boolean).join(', ');
  }
  if (rollup.number !== undefined && rollup.number !== null) return String(rollup.number);
  if (rollup.date) return rollup.date.start || '';
  return '';
}

function extractDriveFolderId_(value) {
  if (!value) return '';

  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/,
  ];

  for (const pattern of patterns) {
    const match = String(value).match(pattern);
    if (match) return match[1];
  }

  const parts = String(value).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function buildAffaireFolderName_(payload, affairePage) {
  const description = getPropertyText_(affairePage, 'Description') || payload.client || '';
  const prefix = payload.numero_affaire || 'Affaire';
  return sanitizeFilename_(`${prefix} - ${description}`.trim()).substring(0, 120);
}

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error(`Propriete Apps Script manquante: ${name}`);
  }

  return value;
}

function parseJsonResponse_(response, label) {
  try {
    return JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error(`${label} n a pas retourne une reponse JSON exploitable.`);
  }
}

function cleanErrorMessage_(error) {
  const message = String(error && error.message ? error.message : error || '').trim();
  return message ? message.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 700) : 'Erreur inconnue.';
}

function normalizeArray_(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function isoDateForName_(date) {
  return String(date || '').replace(/\//g, '-');
}

function sanitizeFilename_(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '-');
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

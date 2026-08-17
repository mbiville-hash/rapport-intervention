# rapport-intervention

Formulaire de rapport d'intervention Fortis Renovation, utilise depuis un
telephone sur le chantier. Le rapport est mis en page en PDF, puis range dans le
dossier Drive de l'affaire.

## Chaine de traitement

```
Navigateur (React)
  ├─ /api/upload-photo ──► Apps Script ──► Drive « Photos, plans et notes »
  └─ /api/submit ───────► Apps Script
                             ├─ Notion : dossier Drive de l'affaire
                             ├─ /api/pdf  (Vercel)  ──► le PDF
                             └─ Drive : depot du rapport
```

La generation du PDF ne depend plus d'aucun service payant. Elle est faite par
`/api/pdf`, avec `pdf-lib` : pas de navigateur sans tete, pas de quota, pas
d'abonnement. Un rapport courant est produit en 200 a 600 ms.

## Configuration du webhook

Le formulaire envoie les rapports via `/api/submit`. Les photos sont envoyees au
fil de l'eau via `/api/upload-photo`. Ces deux routes serveur transmettent
ensuite le JSON vers l'automatisation Apps Script configuree dans les variables
d'environnement.

Variables a configurer sur Vercel :

- `WEBHOOK_URL` : URL de la Web App Apps Script, par exemple `https://script.google.com/macros/s/xxx/exec`.
- `WEBHOOK_SECRET` : optionnel, meme valeur que la propriete Apps Script `WEBHOOK_SECRET`.
- `PDF_SECRET` : secret partage protegeant `/api/pdf`, a recopier dans la propriete Apps Script du meme nom. A defaut, `WEBHOOK_SECRET` est utilise. Sans l'un des deux, Apps Script recoit une reponse 401.
- `APP_PIN` et `SESSION_SECRET` : acces du technicien au formulaire.
- `NOTION_TOKEN` : lecture de la base des affaires.
- `VITE_CLOUDINARY_CLOUD_NAME` : nom du cloud Cloudinary pour les signatures.
- `VITE_CLOUDINARY_UPLOAD_PRESET` : preset Cloudinary pour les signatures.

Le secret webhook n'est pas visible par le technicien : il est ajoute cote
serveur au moment d'appeler Apps Script.

Les photos ne passent plus par Cloudinary. Elles sont compressees dans le
navigateur, envoyees a Apps Script, puis rangees dans le sous-dossier Drive
`Photos, plans et notes`. Le PDF final est cree a la racine du dossier affaire.

## Generation du PDF

### `POST /api/pdf`

Authentification, au choix :

- en-tete `x-fortis-secret` (ou `?secret=`) egal a `PDF_SECRET` / `WEBHOOK_SECRET` ;
- en-tete `Authorization: Bearer <jeton de session du formulaire>`.

Corps : la charge utile du formulaire, plus deux champs facultatifs.

| Champ | Role |
| --- | --- |
| `drive_token` | jeton OAuth Google. Permet a l'endpoint de telecharger les photos par `fileId` sans les faire transiter en base64. |
| `format` | `base64` pour recevoir `{ ok, filename, pdf_base64, warnings }` au lieu du binaire. |

Reponse par defaut : le PDF (`application/pdf`), avec le nom de fichier attendu
par Drive dans `Content-Disposition`. Les images illisibles sont ignorees plutot
que de faire echouer le rapport ; elles sont alors listees dans l'en-tete
`x-fortis-warnings`.

Chaque photo peut etre decrite de trois facons, dans cet ordre de preference :

```jsonc
{ "fileId": "1AbC…" }                 // + drive_token : rien ne transite en base64
{ "data": "data:image/jpeg;base64,…" } // utile pour tester sans Drive
{ "url": "https://…/photo.jpg" }       // URL publique
```

### Mise en page

Le rendu vit dans `lib/pdf/` :

- `theme.js` : couleurs et metriques. Elles sont exprimees dans les pixels CSS du
  template d'origine, puis converties en points par le facteur `PX`. L'ancienne
  chaine rendait un document de 210 mm de large dans une page A4 pourvue de
  marges de 10 mm : le facteur `190/210` rejoue exactement cette reduction, ce
  qui garde les nouveaux rapports superposables aux anciens.
- `fonts.js` : chargement de Montserrat et Bodoni Moda depuis `assets/fonts/`.
- `text.js` : mesure, cesure, interlettrage, positionnement des lignes de base.
- `images.js` : recuperation des photos et signatures, embarquement JPEG/PNG.
- `render.js` : moteur de flux vertical, pagination, blocs du rapport.

Les polices sont embarquees en CID TrueType et sous-ensemblees : le texte du PDF
est selectionnable et cherchable, ce qui n'etait pas le cas des rapports produits
auparavant.

### Apercu local

```bash
node scripts/preview-pdf.mjs rapport.pdf            # rapport d'exemple
node scripts/preview-pdf.mjs rapport.pdf payload.json
```

## Apps Script

Le code de l'automatisation est versionne dans `apps-script/Code.gs`. Proprietes
du script a configurer :

| Propriete | Role |
| --- | --- |
| `NOTION_TOKEN` | jeton d'integration Notion |
| `PDF_ENDPOINT` | `https://intervention.fortisrenovation.fr/api/pdf` |
| `PDF_SECRET` | meme valeur que sur Vercel |
| `WEBHOOK_SECRET` | facultatif, secret partage avec `/api/submit` |
| `DRIVE_FALLBACK_FOLDER_ID` | dossier tampon des rapports sans affaire |
| `REPORT_MAIL_MODE` | `brouillon` (defaut) ou `envoi` |
| `REPORT_MAIL_TO` | facultatif, force le destinataire de tous les rapports |
| `REPORT_MAIL_CC` | facultatif, adresse en copie systematique |
| `REPORT_MAIL_REPLY_TO` | facultatif, adresse de reponse |

`PDFCO_API_KEY` n'est plus utilisee et peut etre supprimee.

Deux fonctions de verification, a lancer une fois apres le deploiement :

- `testPdfEndpoint()` valide la liaison avec Vercel sans rien ecrire dans Drive ;
- `testMailPreview()` affiche le sujet, le destinataire et le corps du mail sans
  rien envoyer.

## Mail du rapport

Une fois le PDF depose dans Drive, Apps Script prepare le mail correspondant,
PDF en piece jointe.

### Brouillon ou envoi

`REPORT_MAIL_MODE` pilote le comportement :

- `brouillon` (defaut) : le mail est depose dans les brouillons Gmail. Rien ne
  part tant qu'il n'a pas ete relu et envoye a la main.
- `envoi` : le mail part directement, sans relecture.

Seule la valeur exacte `envoi` declenche un envoi ; toute autre valeur, y
compris une faute de frappe ou une propriete absente, laisse le mode brouillon.

### Contenu

- Destinataire : `REPORT_MAIL_TO` s'il est defini, sinon l'adresse client saisie
  dans le formulaire. Sans adresse, rien n'est prepare et le PDF reste dans Drive.
- Sujet : `Rapport d'intervention — AFF-024 — 17/06/2026`. La reference retombe
  sur la reference libre puis sur l'equipement quand il n'y a pas d'affaire.
- Corps : version texte et version HTML, avec le rappel de l'affaire, de
  l'equipement, du technicien et des horaires. Aucun lien Drive n'y figure, pour
  ne pas exposer le dossier interne au client.

Un echec n'interrompt jamais le rapport : le PDF est deja dans Drive. L'erreur
est remontee dans la reponse (`mailError`) et dans les journaux.

`GmailApp` et `MailApp` introduisent de nouvelles autorisations OAuth : au
premier lancement apres la mise a jour, Apps Script demande de reautoriser le
projet, et la Web App doit etre redeployee.

## Rapport sans affaire

Le formulaire peut envoyer un rapport sans affaire Notion. Dans ce cas, Apps
Script utilise son dossier tampon :

```text
DRIVE_FALLBACK_FOLDER_ID=12lsSe3SB1_k-ZgE3AyyMe55JSd5_zyDO
```

Cette variable se configure dans les proprietes du projet Apps Script, pas dans
Vercel.

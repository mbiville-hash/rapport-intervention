# rapport-intervention

## Configuration du webhook

Le formulaire envoie les rapports via `/api/submit`. Les photos sont envoyees au fil de l'eau via `/api/upload-photo`. Ces deux routes serveur transmettent ensuite le JSON vers l'automatisation Apps Script configuree dans les variables d'environnement.

Variables a configurer sur Vercel :

- `WEBHOOK_URL` : URL de la Web App Apps Script, par exemple `https://script.google.com/macros/s/xxx/exec`.
- `WEBHOOK_SECRET` : optionnel, meme valeur que la propriete Apps Script `WEBHOOK_SECRET`.
- `VITE_CLOUDINARY_CLOUD_NAME` : nom du cloud Cloudinary pour les signatures.
- `VITE_CLOUDINARY_UPLOAD_PRESET` : preset Cloudinary pour les signatures.

Le secret webhook n'est pas visible par le technicien : il est ajoute cote serveur au moment d'appeler Apps Script.

Les photos ne passent plus par Cloudinary. Elles sont compressees dans le navigateur, envoyees a Apps Script, puis rangees dans le sous-dossier Drive `Photos, plans et notes`. Le PDF final est cree a la racine du dossier affaire.

## Rapport sans affaire

Le formulaire peut envoyer un rapport sans affaire Notion. Dans ce cas, Apps Script doit utiliser son dossier tampon :

```text
DRIVE_FALLBACK_FOLDER_ID=12lsSe3SB1_k-ZgE3AyyMe55JSd5_zyDO
```

Cette variable se configure dans les proprietes du projet Apps Script, pas dans Vercel.

# rapport-intervention

## Configuration du webhook

Le formulaire envoie les rapports via `/api/submit`. Cette route serveur transmet ensuite le JSON vers l'automatisation configuree dans les variables d'environnement.

Variables a configurer sur Vercel :

- `WEBHOOK_URL` : URL de la Web App Apps Script, par exemple `https://script.google.com/macros/s/xxx/exec`.
- `WEBHOOK_SECRET` : optionnel, meme valeur que la propriete Apps Script `WEBHOOK_SECRET`.

Le secret n'est pas visible par le technicien : il est ajoute cote serveur au moment d'appeler Apps Script.

## Rapport sans affaire

Le formulaire peut envoyer un rapport sans affaire Notion. Dans ce cas, Apps Script doit utiliser son dossier tampon :

```text
DRIVE_FALLBACK_FOLDER_ID=12lsSe3SB1_k-ZgE3AyyMe55JSd5_zyDO
```

Cette variable se configure dans les proprietes du projet Apps Script, pas dans Vercel.

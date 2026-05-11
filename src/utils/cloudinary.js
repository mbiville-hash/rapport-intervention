import imageCompression from 'browser-image-compression'

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

async function readUploadResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.secure_url) {
    const message = data.error?.message || `Erreur Cloudinary ${res.status}`
    throw new Error(message)
  }

  return data.secure_url
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.readAsDataURL(file)
  })
}

export async function compressAndUpload(file, context) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.22,
    maxWidthOrHeight: 1280,
    initialQuality: 0.68,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })

  const dataUrl = await fileToDataUrl(compressed)
  const res = await fetch('/api/upload-photo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.token}`,
    },
    body: JSON.stringify({
      category: context.category,
      numero_affaire: context.numero_affaire,
      notion_affaire_id: context.notion_affaire_id,
      sans_affaire: context.sans_affaire,
      reference_libre: context.reference_libre,
      date: context.date,
      original_name: file.name,
      mime_type: compressed.type || 'image/jpeg',
      data_url: dataUrl,
    }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload.photo) {
    throw new Error(payload.details || payload.error || 'Upload Drive impossible')
  }

  return payload.photo
}

export async function uploadSignature(dataUrl) {
  const form = new FormData()
  form.append('file', dataUrl)
  form.append('upload_preset', PRESET)
  form.append('folder', 'fortis-signatures')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  })
  return readUploadResponse(res)
}

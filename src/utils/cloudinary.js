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

export async function compressAndUpload(file) {
  // Compression à 400kb max
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  })

  // Upload Cloudinary
  const form = new FormData()
  form.append('file', compressed)
  form.append('upload_preset', PRESET)
  form.append('folder', 'fortis-rapports')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  })
  return readUploadResponse(res)
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

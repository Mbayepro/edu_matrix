export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0 to 1
}

/**
 * Compresse une image côté client avant upload.
 * Utilise l'API Canvas pour redimensionner l'image et réduire sa qualité.
 * Retourne un File compressé (format JPEG).
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7
  } = options

  // Ne compresser que les images
  if (!file.type.startsWith('image/')) {
    return file
  }

  if (file.size < 50 * 1024) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return resolve(file)
        }

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        
        ctx.drawImage(img, 0, 0, width, height)

        const outType = 'image/jpeg'
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file)
            }
            const compressedFile = new File(
              [blob], 
              file.name.replace(/\.[^/.]+$/, ".jpg"), 
              { type: outType, lastModified: Date.now() }
            )
            resolve(compressedFile)
          },
          outType,
          quality
        )
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

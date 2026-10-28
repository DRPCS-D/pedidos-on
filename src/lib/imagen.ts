/** Reducción de fotos en el navegador antes de subirlas a Drive. */

export const LADO_MAXIMO = 1600
export const CALIDAD_JPEG = 0.85

/** Tamaño final de una imagen para que su lado mayor no pase de `max` (sin agrandar). */
export function tamanoReducido(ancho: number, alto: number, max = LADO_MAXIMO): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto)
  if (mayor <= max) return { ancho, alto }
  const f = max / mayor
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) }
}

/** Lee un archivo como base64 (sin el prefijo `data:…;base64,`). */
export function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '')
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    lector.readAsDataURL(blob)
  })
}

/**
 * Devuelve la foto reducida a JPEG. Los formatos que el navegador no puede
 * decodificar (o que no son fotos, como un GIF animado) se suben tal cual.
 */
export async function reducirImagen(archivo: File): Promise<{ blob: Blob; nombre: string; mime: string }> {
  const original = { blob: archivo as Blob, nombre: archivo.name, mime: archivo.type || 'application/octet-stream' }
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return original
  try {
    const bitmap = await createImageBitmap(archivo)
    const { ancho, alto } = tamanoReducido(bitmap.width, bitmap.height)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) return original
    // Fondo blanco: un PNG transparente pasado a JPEG quedaría negro.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, 'image/jpeg', CALIDAD_JPEG))
    // Si por algún motivo pesa más que el original, se conserva el original.
    if (!blob || blob.size >= archivo.size) return original
    return { blob, nombre: archivo.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg' }
  } catch {
    return original
  }
}

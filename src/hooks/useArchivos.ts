import { ejecutar } from '@/lib/ejecutar'
import { aBase64, reducirImagen } from '@/lib/imagen'
import { TABLAS } from '@/lib/tablas'
import type { Archivo } from '@/lib/tipos'
import { useTabla } from './useTabla'

export const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024

/** Archivos de Drive de un producto o pedido. Con `id` null no carga nada. */
export function useArchivos(entidad: 'producto' | 'pedido', id: string | null) {
  const lista = useTabla<Archivo>(TABLAS.archivos, { entidad, entidadId: id }, id !== null)

  /** Sube un archivo (las fotos se reducen antes). Si el id aún no existe, usa `idDestino`. */
  async function subir(archivo: File, idDestino: string | null = id) {
    if (!idDestino) return { error: 'Guarda primero el registro para adjuntar archivos.' }
    const { blob, nombre, mime } = await reducirImagen(archivo)
    if (blob.size > MAX_ARCHIVO_BYTES) return { error: `${archivo.name} supera los 10 MB.` }
    let base64: string
    try {
      base64 = await aBase64(blob)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo leer el archivo.' }
    }
    return ejecutar(
      'subirArchivo',
      { entidad, entidadId: idDestino, nombre, mime, base64 },
      `No se pudo subir ${archivo.name}.`,
    )
  }

  const marcarPrincipal = (archivoId: string) =>
    ejecutar('marcarPrincipal', { id: archivoId }, 'No se pudo marcar la foto principal.')
  const borrar = (archivoId: string) => ejecutar('borrarArchivo', { id: archivoId }, 'No se pudo borrar el archivo.')

  return { ...lista, subir, marcarPrincipal, borrar }
}

/** Miniatura de Drive (la usa la tabla de productos). */
export function urlMiniatura(driveId: string, ancho = 400): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w${ancho}`
}

export function urlArchivo(driveId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/view`
}

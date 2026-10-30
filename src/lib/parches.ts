/**
 * Parches locales sobre una lista ya cargada: se aplican en cuanto el backend confirma una escritura propia, para que
 * la pantalla cambie sin esperar a volver a descargar la tabla. La descarga posterior trae la versión definitiva.
 */

type ConId = { id: string }

/** Lo mismo que hace el backend al guardar: texto recortado, número donde corresponde y «activo» salvo que sea false. */
function normalizar(datos: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(datos)) {
    if (typeof v === 'string') salida[k] = k === 'orden' ? Number(v) || 0 : v.trim()
    else salida[k] = v
  }
  salida.activo = datos.activo !== false
  return salida
}

/** Actualiza el registro `id` o, si no está, lo agrega al final. Sin id (backend viejo) no toca nada. */
export function guardarEnLista<T extends ConId>(lista: T[], id: string | null | undefined, datos: Record<string, unknown>): T[] {
  if (!id) return lista
  const campos = normalizar(datos)
  if (lista.some((r) => r.id === id)) return lista.map((r) => (r.id === id ? { ...r, ...campos } : r))
  return [...lista, { id, ...campos } as unknown as T]
}

/** Quita el registro `id`. */
export function quitarDeLista<T extends ConId>(lista: T[], id: string): T[] {
  return lista.filter((r) => r.id !== id)
}

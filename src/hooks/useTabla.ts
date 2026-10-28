import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  VACIA,
  estaForzando,
  forzarTodo,
  idTabla,
  leerEntrada,
  montar,
  sincronizar,
  suscribir,
  type DefTabla,
} from '@/lib/tablas'

/**
 * Datos de una tabla desde la caché compartida (ver lib/tablas.ts).
 *
 * - `loading`: solo la primera vez que no hay nada que mostrar (con caché no hay spinner).
 * - `actualizando`: hay una descarga en curso detrás de datos ya visibles.
 * - `refetch`: revisa los contadores y baja lo que cambió; úsalo tras una escritura propia.
 * Con `activo=false` no se pide nada.
 */
export function useTabla<T>(def: DefTabla, payload: Record<string, unknown> = {}, activo = true) {
  const payloadJson = JSON.stringify(payload)
  const id = activo ? idTabla(def, payloadJson) : null

  const entrada = useSyncExternalStore(suscribir, () => (id ? leerEntrada(id, def) : VACIA))

  useEffect(() => {
    if (!id) return
    return montar(id, def, JSON.parse(payloadJson))
  }, [id, def, payloadJson])

  const refetch = useCallback(() => sincronizar(), [])

  return {
    data: entrada.data as T[],
    loading: id !== null && !entrada.tieneDatos && entrada.error === null,
    error: entrada.tieneDatos ? null : entrada.error,
    actualizando: entrada.cargando,
    refetch,
  }
}

/** Estado y acción del botón global "Actualizar". */
export function useForzarActualizacion() {
  const forzando = useSyncExternalStore(suscribir, estaForzando)
  return { forzando, forzar: forzarTodo }
}

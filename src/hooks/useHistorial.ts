import { TABLAS } from '@/lib/tablas'
import type { RegistroHistorial } from '@/lib/tipos'
import { useTabla } from './useTabla'

/** Cambios de estado de un pedido o contenedor, del más viejo al más nuevo. Con `id` null no carga. */
export function useHistorial(entidad: 'pedido' | 'contenedor', id: string | null) {
  return useTabla<RegistroHistorial>(TABLAS.historial, { entidad, entidadId: id }, id !== null)
}

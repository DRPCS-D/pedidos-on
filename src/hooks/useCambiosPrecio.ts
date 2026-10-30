import { TABLAS } from '@/lib/tablas'
import type { CambioPrecio } from '@/lib/tipos'
import { useTabla } from './useTabla'

/** Cambios de precio de las líneas de un pedido (a fábrica o de cliente), del más viejo al más nuevo. */
export function useCambiosPrecio(entidad: 'pedido' | 'pedidoCliente', id: string) {
  return useTabla<CambioPrecio>(TABLAS.cambiosPrecio, { entidad, entidadId: id })
}

import { useMemo } from 'react'
import { ejecutar } from '@/lib/ejecutar'
import { TABLAS } from '@/lib/tablas'
import type { Cliente, ItemCatalogo, NombreCatalogo, Proveedor, TablaPrecio, Tamano } from '@/lib/tipos'
import { useTabla } from './useTabla'

interface TiposCatalogo {
  proveedores: Proveedor
  clientes: Cliente
  marcas: ItemCatalogo
  tamanos: Tamano
  tablasPrecio: TablaPrecio
}

const ETIQUETA: Record<NombreCatalogo, string> = {
  proveedores: 'proveedor',
  clientes: 'cliente',
  marcas: 'marca',
  tamanos: 'tamaño',
  tablasPrecio: 'tabla de precios',
}

/**
 * Catálogo simple (proveedores, clientes, marcas o tamaños). `datos` lleva los
 * campos del registro sin el id; con `id` vacío se crea.
 */
export function useCatalogo<N extends NombreCatalogo>(tabla: N) {
  const lista = useTabla<TiposCatalogo[N]>(TABLAS[tabla], { tabla })

  /** id → nombre, para mostrar el nombre en pedidos y productos. */
  const nombres = useMemo(
    () => new Map((lista.data as { id: string; nombre: string }[]).map((r) => [r.id, r.nombre])),
    [lista.data],
  )

  const guardar = (id: string | null, datos: Record<string, unknown>) =>
    ejecutar('guardarCatalogo', { tabla, id: id ?? '', datos }, `No se pudo guardar el ${ETIQUETA[tabla]}.`)
  const borrar = (id: string) =>
    ejecutar('borrarCatalogo', { tabla, id }, `No se pudo borrar el ${ETIQUETA[tabla]}.`)

  return { ...lista, nombres, guardar, borrar }
}

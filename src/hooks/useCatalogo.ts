import { useMemo } from 'react'
import { ejecutarConDatos } from '@/lib/ejecutar'
import { guardarEnLista, quitarDeLista } from '@/lib/parches'
import { TABLAS, parchearTabla } from '@/lib/tablas'
import type { Cliente, ItemCatalogo, NombreCatalogo, Proveedor, ProyeccionGuardada, TablaPrecio, Tamano } from '@/lib/tipos'
import { useTabla } from './useTabla'

interface TiposCatalogo {
  proveedores: Proveedor
  clientes: Cliente
  marcas: ItemCatalogo
  tamanos: Tamano
  tablasPrecio: TablaPrecio
  proyecciones: ProyeccionGuardada
}

/** Con su artículo, para los mensajes: «No se pudo guardar la marca.» */
const ETIQUETA: Record<NombreCatalogo, string> = {
  proveedores: 'el proveedor',
  clientes: 'el cliente',
  marcas: 'la marca',
  tamanos: 'el tamaño',
  tablasPrecio: 'la tabla de precios',
  proyecciones: 'la proyección',
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

  // Al confirmarse la escritura la lista cambia al instante; la descarga que sigue trae la versión definitiva.
  const guardar = async (id: string | null, datos: Record<string, unknown>) => {
    const r = await ejecutarConDatos<{ id?: string }>('guardarCatalogo', { tabla, id: id ?? '', datos }, `No se pudo guardar ${ETIQUETA[tabla]}.`)
    if (!r.error) parchearTabla(TABLAS[tabla], { tabla }, (lista) => guardarEnLista(lista as { id: string }[], id || r.data?.id, datos))
    return { error: r.error }
  }
  const borrar = async (id: string) => {
    const r = await ejecutarConDatos('borrarCatalogo', { tabla, id }, `No se pudo borrar ${ETIQUETA[tabla]}.`)
    if (!r.error) parchearTabla(TABLAS[tabla], { tabla }, (lista) => quitarDeLista(lista as { id: string }[], id))
    return { error: r.error }
  }

  return { ...lista, nombres, guardar, borrar }
}

import { useMemo } from 'react'
import { ejecutar, ejecutarConDatos } from '@/lib/ejecutar'
import { TABLAS } from '@/lib/tablas'
import type { Producto } from '@/lib/tipos'
import { useTabla } from './useTabla'

export interface DatosProducto {
  codigo: string
  descripcion: string
  color: string
  marcaId: string
  tamanoId: string
  proveedorId: string
  precioCosto: number
  precioVentaUsd: number
  precioVentaGs: number
  activo: boolean
}

export function useProductos() {
  const lista = useTabla<Producto>(TABLAS.productos)

  const porId = useMemo(() => new Map(lista.data.map((p) => [p.id, p])), [lista.data])

  /** Devuelve el id (nuevo o existente) para poder subir la foto enseguida. */
  const guardar = (id: string | null, datos: DatosProducto) =>
    ejecutarConDatos<{ id: string }>('guardarProducto', { id: id ?? '', datos }, 'No se pudo guardar el producto.')
  const borrar = (id: string) => ejecutar('borrarProducto', { id }, 'No se pudo borrar el producto.')

  return { ...lista, porId, guardar, borrar }
}

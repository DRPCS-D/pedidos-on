import { useMemo } from 'react'
import { ejecutar, ejecutarConDatos } from '@/lib/ejecutar'
import { TABLAS } from '@/lib/tablas'
import type { EstadoPedido, Pedido } from '@/lib/tipos'
import { useTabla } from './useTabla'

export interface DatosLinea {
  /** Vacío en una línea nueva. */
  id: string
  productoId: string
  cantidad: number
  precioCosto: number
  precioVentaUsd: number
  precioVentaGs: number
}

export interface DatosPedido {
  proveedorId: string
  clienteId: string
  fechaPedido: string
  notas: string
  lineas: DatosLinea[]
}

export function usePedidos() {
  const lista = useTabla<Pedido>(TABLAS.pedidos)

  const porId = useMemo(() => new Map(lista.data.map((p) => [p.id, p])), [lista.data])

  const guardar = (id: string | null, datos: DatosPedido) =>
    ejecutarConDatos<{ id: string; folio: string }>(
      'guardarPedido',
      { id: id ?? '', ...datos },
      'No se pudo guardar el pedido.',
    )
  const cambiarEstado = (id: string, estado: EstadoPedido, fecha: string, nota: string) =>
    ejecutar('cambiarEstadoPedido', { id, estado, fecha, nota }, 'No se pudo cambiar el estado.')
  const borrar = (id: string) => ejecutar('borrarPedido', { id }, 'No se pudo borrar el pedido.')
  const deshacerEstado = (id: string) =>
    ejecutar('deshacerEstado', { entidad: 'pedido', id }, 'No se pudo deshacer el cambio.')

  return { ...lista, porId, guardar, cambiarEstado, borrar, deshacerEstado }
}

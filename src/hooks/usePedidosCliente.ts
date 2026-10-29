import { useMemo } from 'react'
import { ejecutar, ejecutarConDatos } from '@/lib/ejecutar'
import { TABLAS } from '@/lib/tablas'
import type { EstadoPedidoCliente, PedidoCliente } from '@/lib/tipos'
import type { DatosLinea } from './usePedidos'
import { useTabla } from './useTabla'

export interface DatosPedidoCliente {
  clienteId: string
  fecha: string
  notas: string
  lineas: DatosLinea[]
  /** Asignar al guardar lo que ya esté disponible en pedidos a fábrica. */
  asignar: boolean
}

export interface AsignacionDatos {
  pcLineaId: string
  lineaId: string
  cantidad: number
}

export function usePedidosCliente() {
  const lista = useTabla<PedidoCliente>(TABLAS.pedidosCliente)

  const porId = useMemo(() => new Map(lista.data.map((p) => [p.id, p])), [lista.data])

  const guardar = (id: string | null, datos: DatosPedidoCliente) =>
    ejecutarConDatos<{ id: string; folio: string; asignado: number }>(
      'guardarPedidoCliente',
      { id: id ?? '', ...datos },
      'No se pudo guardar el pedido del cliente.',
    )
  /** Reemplaza las asignaciones del pedido por las indicadas. */
  const asignar = (pcId: string, asignaciones: AsignacionDatos[]) =>
    ejecutar('asignarPedidoCliente', { pcId, asignaciones }, 'No se pudo guardar la asignación.')
  /** Asigna lo disponible a un pedido (o a todos los registrados si no se indica). */
  const asignarAutomatico = (pcId?: string) =>
    ejecutarConDatos<{ asignado: number }>('asignarAutomatico', { pcId: pcId ?? '' }, 'No se pudo asignar.')
  const cambiarEstado = (id: string, estado: EstadoPedidoCliente, fecha: string, nota: string) =>
    ejecutar('cambiarEstadoPedidoCliente', { id, estado, fecha, nota }, 'No se pudo cambiar el estado.')
  const borrar = (id: string) => ejecutar('borrarPedidoCliente', { id }, 'No se pudo borrar el pedido.')
  const deshacerEstado = (id: string) =>
    ejecutar('deshacerEstado', { entidad: 'pedidoCliente', id }, 'No se pudo deshacer el cambio.')

  return { ...lista, porId, guardar, asignar, asignarAutomatico, cambiarEstado, borrar, deshacerEstado }
}

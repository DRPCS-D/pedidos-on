/** Lógica pura de los pedidos de cliente: qué falta cubrir, dónde está lo cubierto y qué pedir a la fábrica. */
import { ESTADOS_PEDIDO, type EstadoPedido, type Pedido, type PedidoCliente } from './tipos'

export type Cobertura = 'sin_asignar' | 'parcial' | 'completa'

export const COBERTURA_LABEL: Record<Cobertura, string> = {
  sin_asignar: 'Sin pedir a fábrica',
  parcial: 'Cubierto en parte',
  completa: 'Cubierto',
}

export interface Situacion {
  cobertura: Cobertura
  /** Unidades pedidas por el cliente y ya cubiertas desde pedidos a fábrica. */
  pedido: number
  asignado: number
  /** Estado del pedido a fábrica menos avanzado entre los que lo abastecen (null si no hay ninguno). */
  estado: EstadoPedido | null
}

/** ¿Cuánto está cubierto el pedido y en qué estado va lo cubierto? */
export function situacionDe(pc: Pick<PedidoCliente, 'lineas'>, pedidos: Map<string, Pick<Pedido, 'estado'>>): Situacion {
  const pedido = pc.lineas.reduce((s, l) => s + l.cantidad, 0)
  const asignado = pc.lineas.reduce((s, l) => s + Math.min(l.asignado, l.cantidad), 0)
  let estado: EstadoPedido | null = null
  for (const l of pc.lineas) {
    for (const a of l.asignaciones) {
      const e = pedidos.get(a.pedidoId)?.estado
      if (!e || e === 'cancelado') continue
      if (estado === null || ESTADOS_PEDIDO.indexOf(e) < ESTADOS_PEDIDO.indexOf(estado)) estado = e
    }
  }
  const cobertura: Cobertura = asignado <= 0 ? 'sin_asignar' : asignado >= pedido ? 'completa' : 'parcial'
  return { cobertura, pedido, asignado, estado }
}

/** Una variante (producto, color y tamaño) que los clientes piden y todavía no está cubierta. */
export interface Pendiente {
  productoId: string
  color: string
  tamanoId: string
  cantidad: number
}

/** Suma lo que falta cubrir de los pedidos de cliente registrados, por variante. */
export function pendientesDeClientes(pcs: PedidoCliente[]): Pendiente[] {
  const m = new Map<string, Pendiente>()
  for (const pc of pcs) {
    if (pc.estado !== 'registrado') continue
    for (const l of pc.lineas) {
      const falta = l.cantidad - l.asignado
      if (falta <= 0) continue
      const k = `${l.productoId}|${l.color.toUpperCase()}|${l.tamanoId}`
      const previo = m.get(k)
      if (previo) previo.cantidad += falta
      else m.set(k, { productoId: l.productoId, color: l.color, tamanoId: l.tamanoId, cantidad: falta })
    }
  }
  return [...m.values()]
}

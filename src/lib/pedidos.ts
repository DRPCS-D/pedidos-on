/** Lógica pura de pedidos y contenedores (la espeja `estadoHeredado_` de Code.gs). */
import {
  ESTADOS_CONTENEDOR,
  ESTADOS_PEDIDO,
  type EstadoContenedor,
  type EstadoPedido,
  type LineaPedido,
  type Pedido,
} from './tipos'

/** Cantidad de una línea que todavía no está en ningún contenedor. */
export function pendienteLinea(l: Pick<LineaPedido, 'cantidad' | 'cargado'>): number {
  return Math.max(0, l.cantidad - l.cargado)
}

export interface TotalesPedido {
  unidades: number
  costo: number
  ventaUsd: number
  ventaGs: number
}

export function totalesLineas(lineas: Pick<LineaPedido, 'cantidad' | 'precioCosto' | 'precioVentaUsd' | 'precioVentaGs'>[]): TotalesPedido {
  const t: TotalesPedido = { unidades: 0, costo: 0, ventaUsd: 0, ventaGs: 0 }
  for (const l of lineas) {
    t.unidades += l.cantidad
    t.costo += l.cantidad * l.precioCosto
    t.ventaUsd += l.cantidad * l.precioVentaUsd
    t.ventaGs += l.cantidad * l.precioVentaGs
  }
  return t
}

export type CargaPedido = 'sin_cargar' | 'parcial' | 'completa'

/** ¿Cuánto del pedido ya está asignado a contenedores? */
export function cargaDePedido(p: Pick<Pedido, 'lineas'>): CargaPedido {
  const pedido = p.lineas.reduce((s, l) => s + l.cantidad, 0)
  const cargado = p.lineas.reduce((s, l) => s + Math.min(l.cargado, l.cantidad), 0)
  if (cargado <= 0) return 'sin_cargar'
  return cargado >= pedido ? 'completa' : 'parcial'
}

export const CARGA_LABEL: Record<CargaPedido, string> = {
  sin_cargar: 'Sin cargar',
  parcial: 'Embarque parcial',
  completa: 'Cargado completo',
}

/**
 * Estado de un pedido según los contenedores que ya salieron (todos menos
 * "preparando"): el menos avanzado. Si ninguno salió y el pedido estaba en un
 * estado heredado, vuelve a "fabricado".
 */
export function estadoHeredado(estadosContenedor: EstadoContenedor[], actual: EstadoPedido): EstadoPedido {
  const despachados = estadosContenedor.filter((e) => e !== 'preparando')
  if (despachados.length === 0) {
    return ESTADOS_PEDIDO.indexOf(actual) >= ESTADOS_PEDIDO.indexOf('embarcado') && actual !== 'cancelado' && actual !== 'entregado'
      ? 'fabricado'
      : actual
  }
  const menor = despachados.reduce((m, e) => (ESTADOS_CONTENEDOR.indexOf(e) < ESTADOS_CONTENEDOR.indexOf(m) ? e : m))
  return menor
}

/** Siguiente estado manual sugerido para el botón «Avanzar», o null si no hay (viaja o terminó). */
export function siguienteEstadoManual(estado: EstadoPedido): EstadoPedido | null {
  switch (estado) {
    case 'registrado':
      return 'confirmado'
    case 'confirmado':
      return 'en_fabricacion'
    case 'en_fabricacion':
      return 'fabricado'
    case 'desembarcado':
      return 'entregado'
    default:
      return null
  }
}

/**
 * Estados que se pueden poner a mano desde el estado actual (lo mismo que
 * valida `handleCambiarEstadoPedido_`): una vez embarcado, solo los
 * contenedores lo mueven, salvo la entrega final.
 */
export function estadosManualesPermitidos(estado: EstadoPedido, conCargas: boolean): EstadoPedido[] {
  if (estado === 'entregado') return []
  const viajando = ESTADOS_PEDIDO.indexOf(estado) >= ESTADOS_PEDIDO.indexOf('embarcado') && estado !== 'cancelado'
  if (viajando) return estado === 'desembarcado' ? ['entregado'] : []
  const lista = (['registrado', 'confirmado', 'en_fabricacion', 'fabricado'] as EstadoPedido[]).filter((e) => e !== estado)
  if (!conCargas && estado !== 'cancelado') lista.push('cancelado')
  return lista
}

/** ¿Alguna línea del pedido está cargada en un contenedor? */
export function tieneCargas(p: Pick<Pedido, 'lineas'>): boolean {
  return p.lineas.some((l) => l.cargado > 0)
}

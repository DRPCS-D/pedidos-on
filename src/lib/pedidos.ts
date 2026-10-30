/** Lógica pura de pedidos y contenedores (la espeja `estadoHeredado_` de Code.gs). */
import {
  ESTADOS_CONTENEDOR,
  ESTADOS_PEDIDO,
  type EstadoContenedor,
  type CargoPedido,
  type DescuentoTipo,
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

export function totalesLineas(
  lineas: (Pick<LineaPedido, 'cantidad' | 'precioVentaUsd' | 'precioVentaGs'> & { precioCosto?: number })[],
): TotalesPedido {
  const t: TotalesPedido = { unidades: 0, costo: 0, ventaUsd: 0, ventaGs: 0 }
  for (const l of lineas) {
    t.unidades += l.cantidad
    t.costo += l.cantidad * (l.precioCosto ?? 0)
    t.ventaUsd += l.cantidad * l.precioVentaUsd
    t.ventaGs += l.cantidad * l.precioVentaGs
  }
  return t
}

export interface AjustesCosto {
  descuentoTipo: DescuentoTipo
  descuentoValor: number
  descuentoMotivo: string
  cargos: CargoPedido[]
}

export interface TotalCosto {
  subtotal: number
  /** Monto descontado en USD (nunca más que el subtotal). */
  descuento: number
  cargos: number
  total: number
}

/** Costo del pedido: subtotal de las líneas, menos el descuento sobre ese subtotal, más los cargos adicionales. */
export function totalConAjustes(subtotal: number, a: Omit<AjustesCosto, 'descuentoMotivo'>): TotalCosto {
  const bruto = a.descuentoTipo === 'porcentaje' ? (subtotal * Math.min(a.descuentoValor, 100)) / 100 : a.descuentoTipo === 'monto' ? a.descuentoValor : 0
  const descuento = Math.round(Math.min(Math.max(bruto, 0), subtotal) * 100) / 100
  const cargos = Math.round(a.cargos.reduce((s, c) => s + c.monto, 0) * 100) / 100
  return { subtotal, descuento, cargos, total: Math.round((subtotal - descuento + cargos) * 100) / 100 }
}

export type CargaPedido ='sin_cargar' | 'parcial' | 'completa'

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

/**
 * Líneas agrupadas por producto (en el orden en que aparece cada producto), para
 * que las variantes de un mismo modelo queden juntas aunque una se haya agregado después.
 */
export function agruparPorProducto<T extends { productoId: string }>(lineas: T[]): T[] {
  const grupos = new Map<string, T[]>()
  for (const l of lineas) grupos.set(l.productoId, [...(grupos.get(l.productoId) ?? []), l])
  return [...grupos.values()].flat()
}

export interface GrupoColor<T> {
  clave: string
  /** Líneas (una por tamaño) de un mismo producto y color. */
  lineas: T[]
  cantidad: number
  /** Cajas y unidades por caja del color, o 0 si sus líneas no comparten las mismas cajas. */
  cajas: number
  porCaja: number
  /** «36:5  37:5…», para mostrar el detalle por tamaño. */
  tamanos: string
}

/** Junta las líneas de cada producto y color (una fila por color, con los tamaños sumados). */
export function agruparPorColor<
  T extends { productoId: string; color: string; tamano: string; cantidad: number; porCaja: number; cajas: number },
>(lineas: T[]): GrupoColor<T>[] {
  const grupos = new Map<string, T[]>()
  for (const l of agruparPorProducto(lineas)) {
    const k = `${l.productoId}|${l.color}`
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }
  return [...grupos.entries()].map(([clave, ls]) => {
    const comunes = ls[0].cajas > 0 && ls.every((l) => l.cajas === ls[0].cajas && l.porCaja > 0)
    return {
      clave,
      lineas: ls,
      cantidad: ls.reduce((s, l) => s + l.cantidad, 0),
      cajas: comunes ? ls[0].cajas : 0,
      porCaja: comunes ? ls.reduce((s, l) => s + l.porCaja, 0) : 0,
      tamanos: ls
        .filter((l) => l.tamano)
        .map((l) => `${l.tamano}:${l.cantidad}`)
        .join('  '),
    }
  })
}

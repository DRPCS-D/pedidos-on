/**
 * Volumen (CBM, m³) de lo que se pide y de lo que viaja en un contenedor. El m³ se carga una vez por
 * caja de la curva de cada color (en el pedido a fábrica); de ahí sale el m³ de cada unidad:
 * m³ de la caja ÷ unidades que trae la caja (la suma de la curva).
 */
import type { Carga, LineaPedido, TipoContenedor } from './tipos'

/** Capacidad útil aproximada, en m³, de cada tipo de contenedor (0 = sin referencia). */
export const CAPACIDAD_CBM: Record<TipoContenedor, number> = { '20': 28, '40': 58, '40HC': 68, otro: 0 }

type LineaCbm = Pick<LineaPedido, 'id' | 'productoId' | 'color' | 'porCaja' | 'cbmCaja'>

/**
 * m³ por unidad de cada línea de UN pedido (lineaId → m³). Las líneas de un mismo producto y color son los
 * tamaños de una curva: sus `porCaja` suman las unidades de la caja. Sin curva o sin m³ cargado: 0.
 */
export function cbmPorUnidad(lineas: LineaCbm[]): Map<string, number> {
  const unidadesCaja = new Map<string, number>()
  for (const l of lineas) {
    const k = `${l.productoId}|${l.color}`
    unidadesCaja.set(k, (unidadesCaja.get(k) ?? 0) + l.porCaja)
  }
  const out = new Map<string, number>()
  for (const l of lineas) {
    const u = unidadesCaja.get(`${l.productoId}|${l.color}`) ?? 0
    out.set(l.id, l.cbmCaja > 0 && l.porCaja > 0 && u > 0 ? l.cbmCaja / u : 0)
  }
  return out
}

export interface ResumenCbm {
  /** m³ de lo que tiene dato. */
  cbm: number
  /** Unidades que no cuentan por no tener m³ cargado. */
  sinDato: number
}

const redondear = (n: number) => Math.round(n * 1000) / 1000

/** m³ de un conjunto de cantidades (lineaId → unidades) de líneas de varios pedidos. */
export function resumenCbm(cantidades: { lineaId: string; cantidad: number }[], porUnidad: Map<string, number>): ResumenCbm {
  let cbm = 0
  let sinDato = 0
  for (const c of cantidades) {
    const m = porUnidad.get(c.lineaId) ?? 0
    if (m > 0) cbm += c.cantidad * m
    else sinDato += c.cantidad
  }
  return { cbm: redondear(cbm), sinDato }
}

/** m³ de todas las líneas de varios pedidos, con lo que piden (no con lo cargado). */
export function cbmDeLineas(lineas: LineaPedido[]): ResumenCbm {
  return resumenCbm(
    lineas.map((l) => ({ lineaId: l.id, cantidad: l.cantidad })),
    cbmPorUnidad(lineas),
  )
}

/** m³ que lleva un contenedor, dado lo que cargan sus `cargas` y las líneas de los pedidos. */
export function cbmDeCargas(cargas: Pick<Carga, 'lineaId' | 'cantidad'>[], pedidos: { lineas: LineaPedido[] }[]): ResumenCbm {
  const porUnidad = new Map<string, number>()
  for (const p of pedidos) for (const [id, m] of cbmPorUnidad(p.lineas)) porUnidad.set(id, m)
  return resumenCbm(cargas, porUnidad)
}

/** Texto de m³ con coma decimal: «12,35 m³». */
export const formatCbm = (n: number) => `${n.toLocaleString('es-PY', { maximumFractionDigits: 2 })} m³`

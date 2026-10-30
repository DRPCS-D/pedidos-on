/**
 * Tablas de precio: cada tabla es una lista de pasos que parten del costo en USD y le suman un monto fijo
 * o un porcentaje (sobre el costo original o sobre lo acumulado hasta ese paso). El resultado es el precio
 * de venta en USD.
 */
import type { TablaPrecio } from './tipos'

export type TipoPaso = 'porcentaje' | 'monto'
export type BasePaso = 'costo' | 'acumulado'

export interface PasoPrecio {
  etiqueta: string
  tipo: TipoPaso
  /** Solo para porcentajes: sobre el costo original o sobre el subtotal acumulado. */
  base: BasePaso
  valor: number
}

export interface DesglosePaso {
  paso: PasoPrecio
  /** Lo que suma este paso, en USD. */
  monto: number
  /** Subtotal después de este paso. */
  acumulado: number
}

export interface ResultadoPrecio {
  costo: number
  desglose: DesglosePaso[]
  /** Precio de venta en USD, redondeado a centavos. */
  total: number
}

/** Pasos de una tabla guardada (texto JSON); ignora lo que no tenga el formato esperado. */
export function pasosDe(tabla: Pick<TablaPrecio, 'pasos'> | undefined): PasoPrecio[] {
  if (!tabla?.pasos) return []
  try {
    const lista: unknown = JSON.parse(tabla.pasos)
    if (!Array.isArray(lista)) return []
    return lista.map((p: Partial<PasoPrecio>) => ({
      etiqueta: String(p.etiqueta ?? ''),
      tipo: p.tipo === 'monto' ? 'monto' : 'porcentaje',
      base: p.base === 'acumulado' ? 'acumulado' : 'costo',
      valor: Number(p.valor) || 0,
    }))
  } catch {
    return []
  }
}

export function calcularPrecio(costo: number, pasos: PasoPrecio[]): ResultadoPrecio {
  let acumulado = costo
  const desglose: DesglosePaso[] = pasos.map((paso) => {
    const base = paso.base === 'acumulado' ? acumulado : costo
    const monto = paso.tipo === 'monto' ? paso.valor : (base * paso.valor) / 100
    acumulado += monto
    return { paso, monto, acumulado }
  })
  return { costo, desglose, total: Math.round(acumulado * 100) / 100 }
}

/** «50% sobre el costo», «38% sobre lo acumulado», «+ USD 2,00»: cómo se lee un paso. */
export function textoPaso(p: PasoPrecio): string {
  const n = p.valor.toLocaleString('es-PY', { maximumFractionDigits: 4 })
  if (p.tipo === 'monto') return `+ USD ${n}`
  return `${n}% sobre ${p.base === 'acumulado' ? 'lo acumulado' : 'el costo'}`
}

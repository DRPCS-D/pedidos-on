import { aDia } from '@/lib/proyeccion'

/** Cuánto falta (o cuánto pasó) desde `hoy` hasta una fecha, en palabras. `que` nombra la fecha: «límite», «inicio». */
export function textoDiasHasta(fecha: string, hoy: string, que: string): string {
  const a = aDia(fecha)
  const b = aDia(hoy)
  if (a === null || b === null) return ''
  const d = a - b
  if (d === 0) return `La fecha ${que} es hoy.`
  const n = Math.abs(d)
  const dias = `${n} ${n === 1 ? 'día' : 'días'}`
  return d > 0 ? `Faltan ${dias} para la fecha ${que}.` : `La fecha ${que} pasó hace ${dias}.`
}

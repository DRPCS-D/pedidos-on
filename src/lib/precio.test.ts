import { describe, expect, it } from 'vitest'
import { calcularPrecio, pasosDe, type PasoPrecio } from './precio'

const importacion: PasoPrecio = { etiqueta: 'Gastos de importación', tipo: 'porcentaje', base: 'costo', valor: 50 }
const margen: PasoPrecio = { etiqueta: 'Margen', tipo: 'porcentaje', base: 'acumulado', valor: 38 }
const royalty: PasoPrecio = { etiqueta: 'Royalty', tipo: 'porcentaje', base: 'costo', valor: 7 }

describe('calcularPrecio', () => {
  it('aplica la fórmula habitual: +50% gastos, +38% margen sobre eso y +7% de royalty sobre el costo', () => {
    const r = calcularPrecio(10, [importacion, margen, royalty])
    expect(r.total).toBe(21.4)
    expect(r.desglose.map((d) => d.monto)).toEqual([5, 5.7, 0.7].map((n) => expect.closeTo(n, 6)))
    expect(r.desglose[1].acumulado).toBeCloseTo(20.7, 6)
  })

  it('el margen sobre el costo original da otro resultado que sobre lo acumulado', () => {
    expect(calcularPrecio(10, [importacion, { ...margen, base: 'costo' }, royalty]).total).toBe(19.5)
  })

  it('admite montos fijos y redondea a centavos', () => {
    expect(calcularPrecio(7.77, [{ etiqueta: 'Etiqueta', tipo: 'monto', base: 'costo', valor: 0.5 }, margen]).total).toBe(11.41)
  })

  it('sin pasos el precio es el costo', () => {
    expect(calcularPrecio(12.5, []).total).toBe(12.5)
  })
})

describe('pasosDe', () => {
  it('lee los pasos guardados y tolera datos rotos', () => {
    expect(pasosDe({ pasos: JSON.stringify([margen]) })).toEqual([margen])
    expect(pasosDe({ pasos: 'no es json' })).toEqual([])
    expect(pasosDe({ pasos: '{"a":1}' })).toEqual([])
    expect(pasosDe(undefined)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { CAPACIDAD_CBM, cbmDeCargas, cbmDeLineas, cbmPorUnidad } from './cbm'
import type { LineaPedido } from './tipos'

// Curva 34/1 35/1 36/2 37/2 38/2 39/1 = 9 pares por caja, 0,09 m³ la caja, 5 cajas.
const curva = [1, 1, 2, 2, 2, 1]
const linea = (i: number, extra: Partial<LineaPedido> = {}) =>
  ({ id: `l${i}`, productoId: 'p1', color: 'NEGRO', porCaja: curva[i], cajas: 5, cantidad: curva[i] * 5, cbmCaja: 0.09, cargado: 0, ...extra }) as LineaPedido
const lineas = curva.map((_, i) => linea(i))

describe('cbm', () => {
  it('reparte el m³ de la caja entre sus unidades', () => {
    const m = cbmPorUnidad(lineas)
    expect(m.get('l0')).toBeCloseTo(0.01)
    expect(m.get('l2')).toBeCloseTo(0.01)
  })

  it('el pedido suma cajas × m³ de la caja', () => {
    const r = cbmDeLineas(lineas)
    expect(r.cbm).toBeCloseTo(0.45) // 5 cajas × 0,09
    expect(r.sinDato).toBe(0)
  })

  it('un contenedor suma las cajas cargadas de varios pedidos', () => {
    const otro = [linea(0, { id: 'x0', porCaja: 2, cajas: 3, cbmCaja: 0.2, cantidad: 6 })]
    const cargas = [...lineas.map((l) => ({ lineaId: l.id, cantidad: l.porCaja * 2 })), { lineaId: 'x0', cantidad: 4 }]
    const r = cbmDeCargas(cargas, [{ lineas }, { lineas: otro }])
    expect(r.cbm).toBeCloseTo(2 * 0.09 + 2 * 0.2)
  })

  it('lo que no tiene m³ no suma y se cuenta aparte', () => {
    const sin = lineas.map((l) => ({ ...l, cbmCaja: 0 }))
    const r = cbmDeLineas(sin)
    expect(r.cbm).toBe(0)
    expect(r.sinDato).toBe(45)
  })

  it('una curva sin cajas ni porCaja no divide por cero', () => {
    const m = cbmPorUnidad([linea(0, { porCaja: 0 })])
    expect(m.get('l0')).toBe(0)
  })

  it('un 40 HC admite más que un 20', () => {
    expect(CAPACIDAD_CBM['40HC']).toBeGreaterThan(CAPACIDAD_CBM['20'])
  })
})

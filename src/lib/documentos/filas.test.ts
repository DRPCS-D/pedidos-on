import { describe, expect, it } from 'vitest'
import { columnasTamano, filasDoc, type LineaDoc } from './filas'

const l = (color: string, tamano: string, cantidad: number, cajas = 5): LineaDoc => ({
  productoId: 'p1',
  codigo: 'ZAP',
  descripcion: 'Zapatilla',
  marca: 'Kyrios',
  color,
  tamano,
  tamanoId: `t${tamano}`,
  cantidad,
  porCaja: 1,
  cajas,
  precioCosto: 5,
  precioVentaUsd: 10,
  precioVentaGs: 75000,
})

describe('filasDoc', () => {
  it('agrupa por producto y color, con cantidades por tamaño y total', () => {
    const f = filasDoc([l('NEGRO', '38', 5), l('NEGRO', '39', 10), l('ROJO', '38', 5)])
    expect(f).toHaveLength(2)
    expect(f[0]).toMatchObject({ color: 'NEGRO', tallas: { t38: 5, t39: 10 }, cantidad: 15, cajas: 5 })
  })

  it('sin cajas comunes deja cajas en 0', () => {
    expect(filasDoc([l('NEGRO', '38', 5, 5), l('NEGRO', '39', 10, 3)])[0].cajas).toBe(0)
  })
})

describe('columnasTamano', () => {
  it('ordena por el catálogo y deja al final los desconocidos', () => {
    const orden = new Map([
      ['t39', 0],
      ['t38', 1],
    ])
    const c = columnasTamano([l('A', '38', 1), l('A', '40', 1), l('A', '39', 1)], orden)
    expect(c.map((x) => x.nombre)).toEqual(['39', '38', '40'])
  })
})

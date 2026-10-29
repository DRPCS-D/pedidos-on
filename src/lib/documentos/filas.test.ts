import { describe, expect, it } from 'vitest'
import { filasDoc, type LineaDoc } from './filas'

const l = (color: string, tamano: string, cantidad: number, cajas = 5): LineaDoc => ({
  productoId: 'p1',
  codigo: 'ZAP',
  descripcion: 'Zapatilla',
  marca: 'Kyrios',
  color,
  tamano,
  cantidad,
  porCaja: 1,
  cajas,
  precioCosto: 5,
  precioVentaUsd: 10,
  precioVentaGs: 75000,
})

describe('filasDoc', () => {
  it('agrupa por producto y color, con tamaños y total', () => {
    const f = filasDoc([l('NEGRO', '38', 5), l('NEGRO', '39', 10), l('ROJO', '38', 5)])
    expect(f).toHaveLength(2)
    expect(f[0]).toMatchObject({ color: 'NEGRO', tamanos: '38:5  39:10', cantidad: 15, cajas: 5 })
  })

  it('sin cajas comunes deja cajas en 0', () => {
    expect(filasDoc([l('NEGRO', '38', 5, 5), l('NEGRO', '39', 10, 3)])[0].cajas).toBe(0)
  })
})

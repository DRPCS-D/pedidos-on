import { describe, expect, it } from 'vitest'
import { claveCelda, claveDeLinea, ejesGrilla, llenarGrilla, totalGrilla } from './grilla'

const t = (id: string, nombre: string) => ({ id, nombre })

describe('ejesGrilla', () => {
  it('usa los colores y tamaños del producto', () => {
    const e = ejesGrilla(['Negro', 'Blanco'], [t('a', '38'), t('b', '39')], [])
    expect(e.colores).toEqual(['Negro', 'Blanco'])
    expect(e.tamanos.map((x) => x.nombre)).toEqual(['38', '39'])
  })

  it('un producto sin colores ni tamaños tiene una única celda', () => {
    const e = ejesGrilla([], [], [])
    expect(e.colores).toEqual([''])
    expect(e.tamanos).toEqual([{ id: '', nombre: '' }])
    expect(Object.keys(llenarGrilla(e, '5'))).toEqual(['|'])
  })

  it('conserva lo pedido aunque el producto ya no tenga ese color o tamaño', () => {
    const e = ejesGrilla(['Negro'], [t('a', '38')], [
      { id: '1', color: 'Rojo', tamanoId: 'z', tamano: '44' },
      { id: '2', color: 'negro', tamanoId: 'a', tamano: '38' },
    ])
    expect(e.colores).toEqual(['Negro', 'Rojo'])
    expect(e.tamanos.map((x) => x.nombre)).toEqual(['38', '44'])
  })
})

describe('celdas', () => {
  it('relaciona una línea guardada con su celda sin distinguir mayúsculas del color', () => {
    const e = ejesGrilla(['Negro'], [t('a', '38')], [])
    expect(claveDeLinea(e, { color: 'NEGRO', tamanoId: 'a' })).toBe(claveCelda('Negro', 'a'))
  })

  it('llena todas las celdas con el mismo valor', () => {
    const e = ejesGrilla(['Negro', 'Blanco'], [t('a', '38'), t('b', '39'), t('c', '40')], [])
    const v = llenarGrilla(e, '6')
    expect(Object.keys(v)).toHaveLength(6)
    expect(totalGrilla(v)).toBe(36)
  })

  it('suma ignorando vacíos y aceptando coma decimal', () => {
    expect(totalGrilla({ a: '2', b: '', c: 'x', d: '1,5' })).toBe(3.5)
  })
})

import { describe, expect, it } from 'vitest'
import { cantidadesDeCurva, claveCelda, claveDeLinea, ejesGrilla, llenarGrilla, totalGrilla, unidadesPorCaja } from './grilla'

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

describe('curva de tamaños', () => {
  const ts = [t('36', '36'), t('37', '37'), t('38', '38'), t('39', '39'), t('40', '40')]
  const curva = { '36': '1', '37': '1', '38': '2', '39': '2', '40': '1' }

  it('suma las unidades de una caja', () => {
    expect(unidadesPorCaja(curva)).toBe(7)
  })

  it('multiplica la curva por las cajas: 7 por 5 cajas = 35', () => {
    const r = cantidadesDeCurva(ts, curva, '5')!
    expect(ts.map((x) => r[x.id])).toEqual(['5', '5', '10', '10', '5'])
    expect(totalGrilla(r)).toBe(35)
  })

  it('sin cajas no cambia la fila, y un tamaño fuera de la curva queda vacío', () => {
    expect(cantidadesDeCurva(ts, curva, '')).toBeNull()
    expect(cantidadesDeCurva(ts, curva, '0')).toBeNull()
    expect(cantidadesDeCurva(ts, { '36': '2' }, '3')!['37']).toBe('')
  })
})

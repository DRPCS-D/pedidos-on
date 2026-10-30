import { describe, expect, it } from 'vitest'
import { aDia, deDia, mesesDe, pausasDe, proyectar } from './proyeccion'

const PAUSA = [{ desde: '2027-01-01', hasta: '2027-02-28' }]

describe('aDia / deDia', () => {
  it('va y vuelve', () => {
    expect(deDia(aDia('2026-11-15')!)).toBe('2026-11-15')
  })
  it('rechaza fechas inválidas', () => {
    expect(aDia('2027-02-31')).toBeNull()
    expect(aDia('15/11/2026')).toBeNull()
  })
})

describe('proyectar', () => {
  it('sin pausa suma los días de fabricación y de tránsito', () => {
    const p = proyectar('2026-10-01', 90, 90, PAUSA)!
    expect(p.finFabricacion).toBe('2026-12-30')
    expect(p.llegada).toBe('2027-03-30')
    expect(p.diasPausa).toBe(0)
    expect(p.diasTotal).toBe(180)
  })

  it('si la pausa cae en medio, la fabricación se corre', () => {
    const p = proyectar('2026-11-15', 90, 90, PAUSA)!
    // 46 días hasta el 31/12, 44 después de la pausa: del 1/3 al 13/4.
    expect(p.finFabricacion).toBe('2027-04-13')
    expect(p.diasPausa).toBe(59)
    expect(p.llegada).toBe('2027-07-12')
  })

  it('el transporte no se frena por la pausa', () => {
    const p = proyectar('2026-09-01', 90, 90, PAUSA)!
    expect(p.finFabricacion).toBe('2026-11-30')
    expect(p.llegada).toBe('2027-02-28')
    expect(p.diasPausa).toBe(0)
  })

  it('marca cada día según lo que ocurre', () => {
    const p = proyectar('2026-12-30', 2, 2, PAUSA)!
    const tipo = (iso: string) => p.dias.get(aDia(iso)!)
    expect(tipo('2026-12-30')).toBe('fabricacion')
    expect(tipo('2026-12-31')).toBe('fabricacion')
    expect(tipo('2027-01-15')).toBe('pausa')
    expect(p.finFabricacion).toBe('2027-03-01')
    expect(tipo('2027-03-01')).toBe('fabricacion')
    expect(tipo('2027-03-02')).toBe('transito')
    expect(p.llegada).toBe('2027-03-03')
  })

  it('si el inicio cae dentro de la pausa, la fabricación arranca al terminar', () => {
    const p = proyectar('2027-01-10', 10, 0, PAUSA)!
    expect(p.finFabricacion).toBe('2027-03-10')
  })

  it('con varias pausas las cuenta todas', () => {
    const p = proyectar('2026-12-01', 60, 0, [
      { desde: '2026-12-20', hasta: '2026-12-31' },
      { desde: '2027-01-10', hasta: '2027-01-14' },
    ])!
    expect(p.diasPausa).toBe(17)
  })

  it('devuelve null con datos que no sirven', () => {
    expect(proyectar('', 90, 90, [])).toBeNull()
    expect(proyectar('2026-10-01', 0, 90, [])).toBeNull()
  })
})

describe('mesesDe', () => {
  it('lista los meses del inicio a la llegada, cruzando el año', () => {
    const p = proyectar('2026-11-15', 30, 60, [])!
    expect(mesesDe(p)).toEqual([
      { anio: 2026, mes: 10 },
      { anio: 2026, mes: 11 },
      { anio: 2027, mes: 0 },
      { anio: 2027, mes: 1 },
    ])
  })
})

describe('pausasDe', () => {
  it('lee el JSON, descarta lo inválido y ordena', () => {
    const t = JSON.stringify([
      { desde: '2028-01-20', hasta: '2028-03-10' },
      { desde: 'x', hasta: '2027-01-01' },
      { desde: '2027-03-01', hasta: '2027-01-01' },
      { desde: '2027-01-01', hasta: '2027-02-28' },
    ])
    expect(pausasDe(t).map((p) => p.desde)).toEqual(['2027-01-01', '2028-01-20'])
    expect(pausasDe('no es json')).toEqual([])
    expect(pausasDe(undefined)).toEqual([])
  })
})

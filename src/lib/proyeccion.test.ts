import { describe, expect, it } from 'vitest'
import { aDia, aniosSinPausa, deDia, fechaDia, mesesDe, pausasDe, proyectar, proyectarInverso } from './proyeccion'

const PAUSA = [{ anio: 2027, desde: '2027-01-01', hasta: '2027-02-28' }]

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
      { anio: 2026, desde: '2026-12-20', hasta: '2026-12-31' },
      { anio: 2027, desde: '2027-01-10', hasta: '2027-01-14' },
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
    expect(pausasDe(t).map((p) => p.anio)).toEqual([2027, 2028])
    expect(pausasDe('no es json')).toEqual([])
    expect(pausasDe(undefined)).toEqual([])
  })
})

describe('proyectarInverso', () => {
  it('calcula hasta cuándo se puede empezar para llegar en la fecha pedida', () => {
    const p = proyectarInverso('2027-07-12', 90, 90, PAUSA)!
    expect(p.inicio).toBe('2026-11-15')
    expect(p.finFabricacion).toBe('2027-04-13')
    expect(p.llegada).toBe('2027-07-12')
  })

  it('sin pausa de por medio resta los dos plazos', () => {
    const p = proyectarInverso('2027-03-30', 90, 90, PAUSA)!
    expect(p.inicio).toBe('2026-10-01')
    expect(p.llegada).toBe('2027-03-30')
  })

  it('un día más tarde ya no llega a tiempo', () => {
    const p = proyectarInverso('2027-07-12', 90, 90, PAUSA)!
    const tarde = proyectar('2026-11-16', 90, 90, PAUSA)!
    expect(aDia(tarde.llegada)!).toBeGreaterThan(aDia('2027-07-12')!)
    expect(aDia(p.llegada)!).toBeLessThanOrEqual(aDia('2027-07-12')!)
  })

  it('si la fecha pedida cae justo en la pausa, llega unos días antes', () => {
    const p = proyectarInverso('2027-04-20', 5, 0, PAUSA)!
    expect(aDia(p.llegada)!).toBeLessThanOrEqual(aDia('2027-04-20')!)
    const tarde = proyectar(deDia(aDia(p.inicio)! + 1), 5, 0, PAUSA)!
    expect(aDia(tarde.llegada)!).toBeGreaterThan(aDia('2027-04-20')!)
  })

  it('devuelve null con datos que no sirven', () => {
    expect(proyectarInverso('', 90, 90, PAUSA)).toBeNull()
  })
})

describe('aniosSinPausa', () => {
  it('avisa del año que cruza la fabricación y no tiene pausa cargada', () => {
    expect(aniosSinPausa('2027-11-15', '2028-04-01', PAUSA)).toEqual([2028])
  })
  it('no avisa si el año ya tiene pausa o la fabricación no toca enero ni febrero', () => {
    expect(aniosSinPausa('2026-11-15', '2027-04-13', PAUSA)).toEqual([])
    expect(aniosSinPausa('2027-03-10', '2027-06-01', [])).toEqual([])
  })
})

describe('fechaDia', () => {
  it('deja igual una fecha de día', () => {
    expect(fechaDia('2027-08-30')).toBe('2027-08-30')
  })
  it('convierte el instante que devuelve Sheets al día local', () => {
    // Medianoche local: el día no se corre aunque el instante esté en UTC.
    const medianoche = new Date(2027, 7, 30).toISOString()
    expect(fechaDia(medianoche)).toBe('2027-08-30')
  })
  it('devuelve vacío con lo que no es fecha', () => {
    expect(fechaDia('')).toBe('')
    expect(fechaDia(undefined)).toBe('')
    expect(fechaDia('hola')).toBe('')
  })
})

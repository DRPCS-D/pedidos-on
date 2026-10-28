import { describe, expect, it } from 'vitest'
import { tamanoReducido } from './imagen'
import {
  cargaDePedido,
  estadoHeredado,
  estadosManualesPermitidos,
  pendienteLinea,
  siguienteEstadoManual,
  totalesLineas,
} from './pedidos'

const linea = (cantidad: number, cargado: number, costo = 1, usd = 2, gs = 15000) => ({
  cantidad,
  cargado,
  precioCosto: costo,
  precioVentaUsd: usd,
  precioVentaGs: gs,
})

describe('estadoHeredado', () => {
  it('toma el contenedor menos avanzado entre los que ya salieron', () => {
    expect(estadoHeredado(['en_transito', 'embarcado'], 'embarcado')).toBe('embarcado')
    expect(estadoHeredado(['desembarcado', 'en_puerto'], 'en_puerto')).toBe('en_puerto')
    expect(estadoHeredado(['desembarcado', 'desembarcado'], 'en_puerto')).toBe('desembarcado')
  })

  it('ignora contenedores en preparación', () => {
    expect(estadoHeredado(['preparando', 'en_transito'], 'fabricado')).toBe('en_transito')
  })

  it('vuelve a fabricado si ningún contenedor salió', () => {
    expect(estadoHeredado(['preparando'], 'embarcado')).toBe('fabricado')
    expect(estadoHeredado([], 'en_transito')).toBe('fabricado')
  })

  it('no toca estados manuales ni finales cuando nada salió', () => {
    expect(estadoHeredado([], 'en_fabricacion')).toBe('en_fabricacion')
    expect(estadoHeredado([], 'entregado')).toBe('entregado')
    expect(estadoHeredado([], 'cancelado')).toBe('cancelado')
  })
})

describe('carga de pedidos', () => {
  it('calcula la cantidad pendiente sin bajar de cero', () => {
    expect(pendienteLinea({ cantidad: 10, cargado: 4 })).toBe(6)
    expect(pendienteLinea({ cantidad: 10, cargado: 12 })).toBe(0)
  })

  it('distingue sin cargar, parcial y completa', () => {
    expect(cargaDePedido({ lineas: [linea(10, 0) as never] })).toBe('sin_cargar')
    expect(cargaDePedido({ lineas: [linea(10, 10) as never, linea(5, 2) as never] })).toBe('parcial')
    expect(cargaDePedido({ lineas: [linea(10, 10) as never, linea(5, 5) as never] })).toBe('completa')
  })

  it('suma unidades y totales', () => {
    const t = totalesLineas([linea(10, 0, 1.5, 3, 20000), linea(2, 0, 10, 20, 150000)])
    expect(t).toEqual({ unidades: 12, costo: 35, ventaUsd: 70, ventaGs: 500000 })
  })
})

describe('siguienteEstadoManual', () => {
  it('avanza por la cadena manual y se detiene cuando viaja', () => {
    expect(siguienteEstadoManual('registrado')).toBe('confirmado')
    expect(siguienteEstadoManual('en_fabricacion')).toBe('fabricado')
    expect(siguienteEstadoManual('fabricado')).toBeNull()
    expect(siguienteEstadoManual('en_transito')).toBeNull()
    expect(siguienteEstadoManual('desembarcado')).toBe('entregado')
  })
})

describe('tamanoReducido', () => {
  it('no agranda imágenes pequeñas', () => {
    expect(tamanoReducido(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('reduce el lado mayor a 1600 conservando la proporción', () => {
    expect(tamanoReducido(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 })
    expect(tamanoReducido(3000, 6000)).toEqual({ ancho: 800, alto: 1600 })
  })
})

describe('estadosManualesPermitidos', () => {
  it('permite retroceder y cancelar mientras no viaja', () => {
    expect(estadosManualesPermitidos('confirmado', false)).toEqual(['registrado', 'en_fabricacion', 'fabricado', 'cancelado'])
  })

  it('no permite cancelar con carga en contenedores', () => {
    expect(estadosManualesPermitidos('fabricado', true)).not.toContain('cancelado')
  })

  it('un pedido cancelado se puede reabrir pero no cancelar de nuevo', () => {
    expect(estadosManualesPermitidos('cancelado', false)).toEqual(['registrado', 'confirmado', 'en_fabricacion', 'fabricado'])
  })

  it('en viaje solo se entrega, y solo si ya desembarcó', () => {
    expect(estadosManualesPermitidos('en_transito', true)).toEqual([])
    expect(estadosManualesPermitidos('desembarcado', true)).toEqual(['entregado'])
    expect(estadosManualesPermitidos('entregado', true)).toEqual([])
  })
})

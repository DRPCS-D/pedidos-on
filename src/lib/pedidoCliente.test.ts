import { describe, expect, it } from 'vitest'
import { pendientesDeClientes, situacionDe } from './pedidoCliente'
import type { LineaPedidoCliente, PedidoCliente } from './tipos'

const linea = (p: Partial<LineaPedidoCliente>): LineaPedidoCliente => ({
  id: 'l',
  pcId: 'pc',
  productoId: 'P',
  codigo: 'P',
  descripcion: '',
  color: 'Negro',
  marca: '',
  tamano: '38',
  tamanoId: 't38',
  cantidad: 10,
  precioVentaUsd: 0,
  precioVentaGs: 0,
  porCaja: 0,
  cajas: 0,
  asignado: 0,
  asignaciones: [],
  ...p,
})

const pc = (lineas: LineaPedidoCliente[], estado: PedidoCliente['estado'] = 'registrado'): PedidoCliente => ({
  id: 'pc',
  folio: 'PC-0001',
  clienteId: 'c',
  estado,
  fecha: '2026-10-01',
  notas: '',
  creadoPor: '',
  creadoNombre: '',
  fechaCreacion: '',
  fechaEstado: '',
  lineas,
})

describe('situacionDe', () => {
  const pedidos = new Map([
    ['A', { estado: 'en_transito' as const }],
    ['B', { estado: 'fabricado' as const }],
    ['X', { estado: 'cancelado' as const }],
  ])

  it('sin asignaciones: sin pedir a fábrica', () => {
    const s = situacionDe(pc([linea({})]), pedidos)
    expect(s).toMatchObject({ cobertura: 'sin_asignar', asignado: 0, pedido: 10, estado: null })
  })

  it('cubierto en parte, con el estado del pedido a fábrica', () => {
    const s = situacionDe(pc([linea({ asignado: 4, asignaciones: [{ lineaId: 'f', pedidoId: 'A', cantidad: 4 }] })]), pedidos)
    expect(s).toMatchObject({ cobertura: 'parcial', asignado: 4, estado: 'en_transito' })
  })

  it('toma el estado menos avanzado entre los pedidos que lo abastecen e ignora los cancelados', () => {
    const l = linea({
      asignado: 10,
      asignaciones: [
        { lineaId: 'f1', pedidoId: 'A', cantidad: 5 },
        { lineaId: 'f2', pedidoId: 'B', cantidad: 3 },
        { lineaId: 'f3', pedidoId: 'X', cantidad: 2 },
      ],
    })
    const s = situacionDe(pc([l]), pedidos)
    expect(s).toMatchObject({ cobertura: 'completa', estado: 'fabricado' })
  })
})

describe('pendientesDeClientes', () => {
  it('suma lo que falta por variante entre pedidos y salta los cubiertos o no registrados', () => {
    const a = pc([linea({ id: '1', cantidad: 10, asignado: 4 }), linea({ id: '2', tamanoId: 't39', cantidad: 5, asignado: 5 })])
    const b = pc([linea({ id: '3', cantidad: 8 })])
    const c = pc([linea({ id: '4', cantidad: 99 })], 'cancelado')
    const r = pendientesDeClientes([a, b, c])
    expect(r).toEqual([{ productoId: 'P', color: 'Negro', tamanoId: 't38', cantidad: 14 }])
  })
})

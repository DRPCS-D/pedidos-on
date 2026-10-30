import { describe, expect, it } from 'vitest'
import { guardarEnLista, quitarDeLista } from './parches'

const lista = [
  { id: 'a', nombre: 'Acme', activo: true },
  { id: 'b', nombre: 'Beta', activo: true },
]

describe('guardarEnLista', () => {
  it('actualiza el registro existente sin tocar los demás', () => {
    const r = guardarEnLista(lista, 'a', { nombre: '  Acme SA  ', activo: false })
    expect(r).toEqual([
      { id: 'a', nombre: 'Acme SA', activo: false },
      { id: 'b', nombre: 'Beta', activo: true },
    ])
    expect(r[1]).toBe(lista[1])
  })

  it('agrega el registro nuevo al final', () => {
    const r = guardarEnLista(lista, 'c', { nombre: 'Gamma' })
    expect(r).toHaveLength(3)
    expect(r[2]).toEqual({ id: 'c', nombre: 'Gamma', activo: true })
  })

  it('como el backend, «activo» solo es falso si se pide', () => {
    expect(guardarEnLista(lista, 'a', { nombre: 'X' })[0].activo).toBe(true)
  })

  it('el orden de los tamaños pasa a número', () => {
    const r = guardarEnLista([] as { id: string }[], 't', { nombre: '38', orden: '3' })
    expect(r[0]).toMatchObject({ orden: 3 })
  })

  it('sin id (backend sin actualizar) deja la lista igual', () => {
    expect(guardarEnLista(lista, undefined, { nombre: 'X' })).toBe(lista)
    expect(guardarEnLista(lista, '', { nombre: 'X' })).toBe(lista)
  })

  it('no modifica la lista original', () => {
    guardarEnLista(lista, 'a', { nombre: 'Cambiado' })
    expect(lista[0].nombre).toBe('Acme')
  })
})

describe('quitarDeLista', () => {
  it('quita solo el registro pedido', () => {
    expect(quitarDeLista(lista, 'a')).toEqual([lista[1]])
    expect(quitarDeLista(lista, 'zzz')).toHaveLength(2)
  })
})

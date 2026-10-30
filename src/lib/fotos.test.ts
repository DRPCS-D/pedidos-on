import { describe, expect, it } from 'vitest'
import { fotoDeColor } from './fotos'

const producto = { fotoId: 'general', fotosColor: { Rojo: 'f-rojo', Azul: 'f-azul' } }

describe('fotoDeColor', () => {
  it('usa la foto del color, sin distinguir mayúsculas', () => {
    expect(fotoDeColor(producto, 'Rojo')).toBe('f-rojo')
    expect(fotoDeColor(producto, 'azul')).toBe('f-azul')
  })

  it('si el color no tiene foto (o no hay color) usa la general', () => {
    expect(fotoDeColor(producto, 'Verde')).toBe('general')
    expect(fotoDeColor(producto, '')).toBe('general')
  })

  it('sin producto o sin fotos devuelve vacío', () => {
    expect(fotoDeColor(undefined, 'Rojo')).toBe('')
    expect(fotoDeColor({ fotoId: '', fotosColor: {} }, 'Rojo')).toBe('')
  })
})

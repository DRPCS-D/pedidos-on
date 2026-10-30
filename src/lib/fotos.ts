import type { Producto } from './tipos'

/**
 * Id de Drive de la foto que representa a un color de un producto: la principal de ese color y, si el
 * color no tiene fotos, la general del producto. Vacío si no hay ninguna. El color no distingue mayúsculas.
 */
export function fotoDeColor(producto: Pick<Producto, 'fotoId' | 'fotosColor'> | undefined, color: string): string {
  if (!producto) return ''
  const buscado = color.trim().toUpperCase()
  if (buscado) {
    for (const [c, id] of Object.entries(producto.fotosColor ?? {})) {
      if (c.toUpperCase() === buscado) return id
    }
  }
  return producto.fotoId
}

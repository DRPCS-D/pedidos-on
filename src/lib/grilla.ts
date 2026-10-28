/**
 * Grilla color × tamaño de un producto dentro de un pedido: cada celda es una
 * línea del pedido. Un producto sin colores o sin tamaños tiene un solo eje
 * vacío (una fila o una columna) y, sin ninguno, una única celda.
 */

export interface TamanoRef {
  id: string
  nombre: string
}

export interface LineaGrilla {
  id: string
  color: string
  tamanoId: string
  tamano: string
}

export interface EjesGrilla {
  colores: string[]
  tamanos: TamanoRef[]
}

export const claveCelda = (color: string, tamanoId: string) => `${color}|${tamanoId}`

const mismoColor = (a: string, b: string) => a.toUpperCase() === b.toUpperCase()

/**
 * Filas y columnas de la grilla: los colores y tamaños que tiene hoy el
 * producto, más los de líneas ya guardadas que el producto ya no tenga (para
 * no perder lo pedido si luego se editó el producto).
 */
export function ejesGrilla(colores: string[], tamanos: TamanoRef[], lineas: LineaGrilla[]): EjesGrilla {
  const cs = [...colores]
  const ts = [...tamanos]
  for (const l of lineas) {
    if (l.color && !cs.some((c) => mismoColor(c, l.color))) cs.push(l.color)
    if (l.tamanoId && !ts.some((t) => t.id === l.tamanoId)) ts.push({ id: l.tamanoId, nombre: l.tamano })
  }
  return { colores: cs.length ? cs : [''], tamanos: ts.length ? ts : [{ id: '', nombre: '' }] }
}

/** Clave de celda de una línea guardada, usando el color tal como está en los ejes. */
export function claveDeLinea(ejes: EjesGrilla, l: Pick<LineaGrilla, 'color' | 'tamanoId'>): string {
  const color = ejes.colores.find((c) => mismoColor(c, l.color)) ?? l.color
  return claveCelda(color, l.tamanoId)
}

/** Todas las celdas con el mismo valor (el botón «misma cantidad en todos los tamaños»). */
export function llenarGrilla(ejes: EjesGrilla, valor: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of ejes.colores) for (const t of ejes.tamanos) out[claveCelda(c, t.id)] = valor
  return out
}

/** Suma de las celdas (los textos no numéricos o vacíos cuentan como cero). */
export function totalGrilla(cantidades: Record<string, string>): number {
  return Object.values(cantidades).reduce((s, v) => s + (Number(String(v).replace(',', '.')) || 0), 0)
}

/** Datos comunes de los documentos (PDF y Excel) de un pedido: una fila por producto y color. */
import { totalConAjustes, type AjustesCosto } from '@/lib/pedidos'

export interface LineaDoc {
  productoId: string
  codigo: string
  descripcion: string
  marca: string
  color: string
  tamano: string
  tamanoId: string
  cantidad: number
  porCaja: number
  cajas: number
  precioCosto?: number
  precioVentaUsd: number
  precioVentaGs: number
}

export interface ColumnaTamano {
  id: string
  nombre: string
}

export interface FilaDoc {
  productoId: string
  codigo: string
  descripcion: string
  marca: string
  color: string
  /** Cantidad de cada tamaño (por id de tamaño). */
  tallas: Record<string, number>
  /** Cajas del color si todas sus líneas comparten las mismas cajas; si no, 0. */
  cajas: number
  cantidad: number
  precioCosto: number
  precioVentaUsd: number
  precioVentaGs: number
}

export function filasDoc(lineas: LineaDoc[]): FilaDoc[] {
  const grupos = new Map<string, LineaDoc[]>()
  for (const l of lineas) {
    const k = `${l.productoId}|${l.color}`
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }
  return [...grupos.values()].map((ls) => {
    const cajas = ls[0].cajas > 0 && ls.every((l) => l.cajas === ls[0].cajas && l.porCaja > 0) ? ls[0].cajas : 0
    const tallas: Record<string, number> = {}
    for (const l of ls) if (l.tamanoId) tallas[l.tamanoId] = (tallas[l.tamanoId] ?? 0) + l.cantidad
    return {
      productoId: ls[0].productoId,
      codigo: ls[0].codigo,
      descripcion: ls[0].descripcion,
      marca: ls[0].marca,
      color: ls[0].color,
      tallas,
      cajas,
      cantidad: ls.reduce((s, l) => s + l.cantidad, 0),
      precioCosto: ls[0].precioCosto ?? 0,
      precioVentaUsd: ls[0].precioVentaUsd,
      precioVentaGs: ls[0].precioVentaGs,
    }
  })
}

/**
 * Tamaños que aparecen en el documento, para usarlos como columnas. `orden` da la posición de cada
 * tamaño en el catálogo (grupo y orden); los que no estén ahí quedan al final, en el orden en que aparecen.
 */
export function columnasTamano(lineas: LineaDoc[], orden: Map<string, number> = new Map()): ColumnaTamano[] {
  const vistos = new Map<string, ColumnaTamano>()
  for (const l of lineas) if (l.tamanoId && !vistos.has(l.tamanoId)) vistos.set(l.tamanoId, { id: l.tamanoId, nombre: l.tamano })
  const pos = (c: ColumnaTamano) => orden.get(c.id) ?? Number.MAX_SAFE_INTEGER
  return [...vistos.values()].sort((a, b) => pos(a) - pos(b))
}

export type MonedaDoc = 'usd' | 'gs' | 'ambas'

export interface EncabezadoDoc {
  /** «PEDIDO A FÁBRICA» / «PEDIDO DE CLIENTE». */
  titulo: string
  folio: string
  /** 'yyyy-MM-dd' */
  fecha: string
  /** Datos de la contraparte (fábrica o cliente), una línea cada uno. */
  contraparteTitulo: string
  contraparte: string[]
  notas: string
  /** Texto de la empresa (varias líneas) y condiciones, de la configuración. */
  empresa: string
  condiciones: string
  /** Descuento y cargos del pedido a fábrica; se muestran junto a los costos. */
  ajustes?: AjustesCosto
}

/** Renglones de cierre de un pedido a fábrica con descuento y/o cargos: subtotal, ajustes y total (USD). */
export function renglonesAjuste(enc: EncabezadoDoc, subtotal: number): { etiqueta: string; monto: number; fuerte?: boolean }[] {
  const a = enc.ajustes
  if (!a) return []
  const t = totalConAjustes(subtotal, a)
  if (t.descuento === 0 && a.cargos.length === 0) return []
  const r: { etiqueta: string; monto: number; fuerte?: boolean }[] = [{ etiqueta: 'Subtotal', monto: t.subtotal }]
  if (t.descuento > 0) {
    const detalle = [a.descuentoTipo === 'porcentaje' ? `${a.descuentoValor}%` : '', a.descuentoMotivo].filter(Boolean).join(' · ')
    r.push({ etiqueta: detalle ? `Descuento (${detalle})` : 'Descuento', monto: -t.descuento })
  }
  for (const c of a.cargos) r.push({ etiqueta: c.concepto, monto: c.monto })
  r.push({ etiqueta: 'TOTAL USD', monto: t.total, fuerte: true })
  return r
}

export interface OpcionesDoc {
  /** Precio que se muestra: costo de la fábrica o venta al cliente. */
  precios: 'costo' | 'venta' | 'ninguno'
  moneda: MonedaDoc
  firma: boolean
  condiciones: boolean
  /** Orden de cada tamaño en el catálogo (por id), para ordenar las columnas. */
  ordenTamanos?: Map<string, number>
  /** Fotos por producto y color (ver `claveFoto`), como data URL, si se pidió incluirlas. */
  fotos?: Map<string, string>
}

/** Clave de la foto de un color de un producto en `OpcionesDoc.fotos`. */
export const claveFoto = (productoId: string, color: string) => `${productoId}|${color.trim().toUpperCase()}`

export const nombreArchivo = (folio: string, ext: 'pdf' | 'xlsx') => `${folio}.${ext}`

/** Datos comunes de los documentos (PDF y Excel) de un pedido: una fila por producto y color. */

export interface LineaDoc {
  productoId: string
  codigo: string
  descripcion: string
  marca: string
  color: string
  tamano: string
  cantidad: number
  porCaja: number
  cajas: number
  precioCosto?: number
  precioVentaUsd: number
  precioVentaGs: number
}

export interface FilaDoc {
  codigo: string
  descripcion: string
  marca: string
  color: string
  /** «36:2  37:2  38:4…» o vacío si no tiene tamaños. */
  tamanos: string
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
    return {
      codigo: ls[0].codigo,
      descripcion: ls[0].descripcion,
      marca: ls[0].marca,
      color: ls[0].color,
      tamanos: ls
        .filter((l) => l.tamano)
        .map((l) => `${l.tamano}:${l.cantidad}`)
        .join('  '),
      cajas,
      cantidad: ls.reduce((s, l) => s + l.cantidad, 0),
      precioCosto: ls[0].precioCosto ?? 0,
      precioVentaUsd: ls[0].precioVentaUsd,
      precioVentaGs: ls[0].precioVentaGs,
    }
  })
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
}

export interface OpcionesDoc {
  /** Precio que se muestra: costo de la fábrica o venta al cliente. */
  precios: 'costo' | 'venta' | 'ninguno'
  moneda: MonedaDoc
  firma: boolean
  condiciones: boolean
}

export const nombreArchivo = (folio: string, ext: 'pdf' | 'xlsx') => `${folio}.${ext}`

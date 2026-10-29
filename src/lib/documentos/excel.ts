import { formatFecha } from '@/lib/format'
import { columnasTamano, filasDoc, nombreArchivo, type EncabezadoDoc, type LineaDoc, type OpcionesDoc } from './filas'

/** Genera y descarga el Excel de un pedido (la librería se carga recién al pedirlo). */
export async function descargarExcel(enc: EncabezadoDoc, lineas: LineaDoc[], opc: OpcionesDoc): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser')

  const filas = filasDoc(lineas)
  const tamanos = columnasTamano(lineas, opc.ordenTamanos)
  const verUsd = opc.precios !== 'ninguno' && (opc.precios === 'costo' || opc.moneda !== 'gs')
  const verGs = opc.precios === 'venta' && opc.moneda !== 'usd'
  const precioUsd = (f: (typeof filas)[number]) => (opc.precios === 'costo' ? f.precioCosto : f.precioVentaUsd)

  const negrita = (value: string) => ({ value, fontWeight: 'bold' as const })
  const numero = (value: number, format: string, fontWeight?: 'bold') => ({ value, type: Number, format, fontWeight })
  const cab = ['Código', 'Descripción', 'Marca', 'Color', ...tamanos.map((t) => t.nombre), 'Cajas', 'Cantidad']
  if (verUsd) cab.push(opc.precios === 'costo' ? 'Costo USD' : 'Precio USD', 'Subtotal USD')
  if (verGs) cab.push('Precio Gs', 'Subtotal Gs')

  const contraparte = enc.contraparte.filter(Boolean).join(' · ')
  const data: unknown[][] = [
    [negrita(enc.titulo), enc.folio],
    ['Fecha', formatFecha(enc.fecha)],
    [negrita(enc.contraparteTitulo), contraparte],
    [],
    cab.map((c) => ({ value: c, fontWeight: 'bold' as const, backgroundColor: '#F5D000' })),
  ]
  for (const f of filas) {
    const r: unknown[] = [
      f.codigo,
      f.descripcion,
      f.marca,
      f.color,
      ...tamanos.map((t) => (f.tallas[t.id] ? numero(f.tallas[t.id], '#,##0') : null)),
      f.cajas || null,
      numero(f.cantidad, '#,##0'),
    ]
    if (verUsd) r.push(numero(precioUsd(f), '#,##0.00'), numero(precioUsd(f) * f.cantidad, '#,##0.00'))
    if (verGs) r.push(numero(f.precioVentaGs, '#,##0'), numero(f.precioVentaGs * f.cantidad, '#,##0'))
    data.push(r)
  }
  const total: unknown[] = [
    '',
    '',
    '',
    negrita('Total'),
    ...tamanos.map((t) => numero(filas.reduce((s, f) => s + (f.tallas[t.id] ?? 0), 0), '#,##0', 'bold')),
    '',
    numero(filas.reduce((s, f) => s + f.cantidad, 0), '#,##0', 'bold'),
  ]
  if (verUsd) total.push('', numero(filas.reduce((s, f) => s + precioUsd(f) * f.cantidad, 0), '#,##0.00', 'bold'))
  if (verGs) total.push('', numero(filas.reduce((s, f) => s + f.precioVentaGs * f.cantidad, 0), '#,##0', 'bold'))
  data.push(total)
  if (enc.notas.trim()) data.push([], [negrita('Observaciones'), enc.notas.trim()])
  if (opc.condiciones && enc.condiciones.trim()) data.push([], [negrita('Condiciones'), enc.condiciones.trim()])

  const anchos = [14, 28, 14, 14, ...tamanos.map(() => 6), 8, 10, ...cab.slice(6 + tamanos.length).map(() => 14)]
  const columns = anchos.map((width) => ({ width }))
  await writeExcelFile(data as never, { columns, sheet: enc.folio }).toFile(nombreArchivo(enc.folio, 'xlsx'))
}

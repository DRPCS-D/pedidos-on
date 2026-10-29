import type { CellDef, RowInput } from 'jspdf-autotable'
import { formatFecha } from '@/lib/format'
import { columnasTamano, filasDoc, nombreArchivo, type EncabezadoDoc, type FilaDoc, type LineaDoc, type OpcionesDoc } from './filas'

const ent = (n: number) => n.toLocaleString('es-PY', { maximumFractionDigits: 0 })
const usd = (n: number) => n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Anchos de columna (mm). */
const ANCHO = { foto: 14, codigo: 17, color: 20, talla: 9, cajas: 13, cant: 12, precioUsd: 19, subUsd: 22, precioGs: 22, subGs: 26, descripcionMin: 30 }
/** Caja de un tamaño en la fila de tamaños (cuando no entran como columnas). */
const CAJA = { ancho: 11, alto: 9 }

async function cargarLogo(): Promise<{ data: string; ancho: number; alto: number } | null> {
  try {
    const blob = await (await fetch('/logo-on.png')).blob()
    const data = await new Promise<string>((ok, fallo) => {
      const r = new FileReader()
      r.onload = () => ok(String(r.result))
      r.onerror = () => fallo(r.error)
      r.readAsDataURL(blob)
    })
    const dim = await new Promise<{ w: number; h: number }>((ok, fallo) => {
      const img = new Image()
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => fallo(new Error('logo'))
      img.src = data
    })
    return { data, ancho: dim.w, alto: dim.h }
  } catch {
    return null
  }
}

interface Columna {
  titulo: string
  ancho: number | null
  der: boolean
  valor: (f: FilaDoc) => string
  pie: string
}

/** Genera y descarga el PDF de un pedido. jsPDF se carga recién al pedirlo (pesa bastante). */
export async function descargarPdf(enc: EncabezadoDoc, lineas: LineaDoc[], opc: OpcionesDoc): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), cargarLogo()])

  const filas = filasDoc(lineas)
  const tamanos = columnasTamano(lineas, opc.ordenTamanos)
  const fotos = opc.fotos && [...opc.fotos.keys()].some((id) => filas.some((f) => f.productoId === id)) ? opc.fotos : null
  const verUsd = opc.precios !== 'ninguno' && (opc.precios === 'costo' || opc.moneda !== 'gs')
  const verGs = opc.precios === 'venta' && opc.moneda !== 'usd'
  const horizontal = verUsd && verGs || tamanos.length > 12
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: horizontal ? 'landscape' : 'portrait' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14
  const reservaFirma = opc.firma ? 40 : 0
  const piePagina = 10

  // Cabecera
  let y = M
  if (logo) {
    const alto = 14
    doc.addImage(logo.data, 'PNG', M, y, (logo.ancho / logo.alto) * alto, alto)
  }
  doc.setFont('helvetica', 'bold').setFontSize(15)
  doc.text(enc.titulo, W - M, y + 5, { align: 'right' })
  doc.setFontSize(12).text(enc.folio, W - M, y + 11, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90)
  doc.text(`Fecha: ${formatFecha(enc.fecha)}`, W - M, y + 16, { align: 'right' })
  y += 20
  doc.setTextColor(0)
  if (enc.empresa.trim()) {
    doc.setFontSize(8.5).setTextColor(80)
    const t = doc.splitTextToSize(enc.empresa.trim(), W / 2 - M)
    doc.text(t, M, y)
    y += t.length * 3.8 + 2
    doc.setTextColor(0)
  }
  doc.setDrawColor(200).line(M, y, W - M, y)
  y += 6

  // Contraparte
  doc.setFont('helvetica', 'bold').setFontSize(9).text(enc.contraparteTitulo.toUpperCase(), M, y)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  for (const l of enc.contraparte.filter(Boolean)) {
    y += 5
    doc.text(l, M, y)
  }
  y += 7

  // Columnas que no son tamaños. Si los tamaños no entran como columnas, van en una fila debajo.
  const precioUsd = (f: FilaDoc) => (opc.precios === 'costo' ? f.precioCosto : f.precioVentaUsd)
  const precios: Columna[] = []
  if (verUsd) {
    precios.push(
      { titulo: opc.precios === 'costo' ? 'Costo USD' : 'Precio USD', ancho: ANCHO.precioUsd, der: true, valor: (f) => usd(precioUsd(f)), pie: '' },
      { titulo: 'Subtotal USD', ancho: ANCHO.subUsd, der: true, valor: (f) => usd(precioUsd(f) * f.cantidad), pie: usd(filas.reduce((s, f) => s + precioUsd(f) * f.cantidad, 0)) },
    )
  }
  if (verGs) {
    precios.push(
      { titulo: 'Precio Gs', ancho: ANCHO.precioGs, der: true, valor: (f) => ent(f.precioVentaGs), pie: '' },
      { titulo: 'Subtotal Gs', ancho: ANCHO.subGs, der: true, valor: (f) => ent(f.precioVentaGs * f.cantidad), pie: ent(filas.reduce((s, f) => s + f.precioVentaGs * f.cantidad, 0)) },
    )
  }
  const inicio: Columna[] = [
    ...(fotos ? [{ titulo: '', ancho: ANCHO.foto, der: false, valor: () => '', pie: '' }] : []),
    { titulo: 'Código', ancho: ANCHO.codigo, der: false, valor: (f) => f.codigo, pie: '' },
    { titulo: 'Descripción', ancho: null, der: false, valor: (f) => [f.descripcion, f.marca].filter(Boolean).join(' · '), pie: '' },
    { titulo: 'Color', ancho: ANCHO.color, der: false, valor: (f) => f.color || '—', pie: '' },
  ]
  const fin: Columna[] = [
    { titulo: 'Cajas', ancho: ANCHO.cajas, der: true, valor: (f) => (f.cajas ? ent(f.cajas) : '—'), pie: '' },
    { titulo: 'Cant.', ancho: ANCHO.cant, der: true, valor: (f) => ent(f.cantidad), pie: ent(filas.reduce((s, f) => s + f.cantidad, 0)) },
    ...precios,
  ]
  const columnasTalla: Columna[] = tamanos.map((t) => ({
    titulo: t.nombre,
    ancho: ANCHO.talla,
    der: false,
    valor: (f) => (f.tallas[t.id] ? ent(f.tallas[t.id]) : ''),
    pie: ent(filas.reduce((s, f) => s + (f.tallas[t.id] ?? 0), 0)),
  }))
  const sumaAnchos = (cs: Columna[]) => cs.reduce((s, c) => s + (c.ancho ?? 0), 0)
  const disponible = W - 2 * M
  const enColumnas = tamanos.length === 0 || sumaAnchos(inicio) + sumaAnchos(fin) + tamanos.length * ANCHO.talla + ANCHO.descripcionMin <= disponible
  const columnas = enColumnas ? [...inicio, ...columnasTalla, ...fin] : [...inicio, ...fin]
  // La descripción se queda con lo que sobra.
  const anchoDescripcion = disponible - sumaAnchos(columnas)
  const columnaDesc = columnas.findIndex((c) => c.ancho === null)

  // Cuerpo: una fila por color o, si los tamaños van debajo, dos (datos y tamaños).
  const hayFotos = fotos !== null
  // Con los tamaños en la fila de abajo, la foto ocupa las dos filas y no hace falta alargar la primera.
  const alturaFila = hayFotos && enColumnas ? 11 : 0
  const tallasDeFila = new Map<number, { nombre: string; cantidad: number }[]>()
  const filaDeIndice = new Map<number, FilaDoc>()
  const cuerpo: RowInput[] = []
  const celdasUltimaFila = columnas.length - (hayFotos ? 1 : 0)
  for (const f of filas) {
    const datos: CellDef[] = columnas.map((c, i) => ({
      content: c.valor(f),
      styles: { halign: c.der ? 'right' : 'left', minCellHeight: alturaFila },
      ...(hayFotos && i === 0 && !enColumnas ? { rowSpan: 2 } : {}),
    }))
    filaDeIndice.set(cuerpo.length, f)
    cuerpo.push(datos)
    if (!enColumnas && tamanos.length > 0) {
      const presentes = tamanos.filter((t) => f.tallas[t.id]).map((t) => ({ nombre: t.nombre, cantidad: f.tallas[t.id] }))
      const anchoCelda = columnas.slice(hayFotos ? 1 : 0).reduce((s, c) => s + (c.ancho ?? anchoDescripcion), 0)
      const porLinea = Math.max(1, Math.floor((anchoCelda - 2) / CAJA.ancho))
      const lineasCajas = Math.max(1, Math.ceil(presentes.length / porLinea))
      tallasDeFila.set(cuerpo.length, presentes)
      cuerpo.push([{ content: '', colSpan: celdasUltimaFila, styles: { minCellHeight: lineasCajas * CAJA.alto + 0.5 } }])
    }
  }
  const pie: CellDef[] = columnas.map((c, i) => ({
    content: i === columnas.findIndex((x) => x.titulo === 'Cajas') ? 'Total' : c.pie,
    styles: { halign: c.der ? 'right' : 'center' },
  }))

  autoTable(doc, {
    startY: y,
    head: [columnas.map((c) => ({ content: c.titulo, styles: { halign: c.der ? 'right' : enColumnas && c.ancho === ANCHO.talla ? 'center' : 'left' } }))],
    body: cuerpo,
    foot: [pie],
    showFoot: 'lastPage',
    margin: { left: M, right: M, bottom: reservaFirma + piePagina + 4 },
    styles: { fontSize: 8.5, cellPadding: 1.4, lineColor: [220, 220, 220], lineWidth: 0.1, valign: 'middle' },
    headStyles: { fillColor: [20, 20, 20], textColor: [245, 208, 0], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(
      columnas.map((c, i) => [i, { cellWidth: i === columnaDesc ? anchoDescripcion : (c.ancho ?? 20), halign: c.ancho === ANCHO.talla ? 'center' : c.der ? 'right' : 'left' }]),
    ),
    didDrawCell: (d) => {
      if (d.section !== 'body') return
      // Foto del producto
      const fila = filaDeIndice.get(d.row.index)
      if (hayFotos && fila && d.column.index === 0) {
        const url = fotos.get(fila.productoId)
        if (url) {
          try {
            const p = doc.getImageProperties(url)
            const caja = Math.min(12, d.cell.height - 1.5)
            const escala = Math.min(caja / p.width, caja / p.height)
            const w = p.width * escala
            const h = p.height * escala
            doc.addImage(url, p.fileType, d.cell.x + (d.cell.width - w) / 2, d.cell.y + (d.cell.height - h) / 2, w, h)
          } catch {
            // Foto ilegible: la fila sale sin ella.
          }
        }
        return
      }
      // Tamaños en cajitas, cuando no entran como columnas
      const presentes = tallasDeFila.get(d.row.index)
      if (!presentes) return
      const porLinea = Math.max(1, Math.floor((d.cell.width - 2) / CAJA.ancho))
      presentes.forEach((t, k) => {
        const x = d.cell.x + 1 + (k % porLinea) * CAJA.ancho
        const yy = d.cell.y + 0.25 + Math.floor(k / porLinea) * CAJA.alto
        doc.setDrawColor(200).setLineWidth(0.1).rect(x, yy, CAJA.ancho - 1, CAJA.alto - 1)
        doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(110)
        doc.text(t.nombre, x + (CAJA.ancho - 1) / 2, yy + 2.8, { align: 'center' })
        doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(0)
        doc.text(ent(t.cantidad), x + (CAJA.ancho - 1) / 2, yy + 6.6, { align: 'center' })
      })
      doc.setFont('helvetica', 'normal')
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 7

  // Notas y condiciones, cuidando no pisar la firma
  const limite = H - reservaFirma - piePagina - 4
  const bloque = (titulo: string, texto: string) => {
    if (!texto.trim()) return
    doc.setFont('helvetica', 'normal').setFontSize(8.5)
    const t = doc.splitTextToSize(texto.trim(), W - 2 * M)
    if (y + 5 + t.length * 3.8 > limite) {
      doc.addPage()
      y = M
    }
    doc.setFont('helvetica', 'bold').setFontSize(9).text(titulo, M, y)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).text(t, M, y + 4.5)
    y += 6 + t.length * 3.8
  }
  bloque('OBSERVACIONES', enc.notas)
  if (opc.condiciones) bloque('CONDICIONES', enc.condiciones)

  // Firma y numeración en todas las hojas
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    if (opc.firma) {
      const base = H - piePagina - 8
      doc.setDrawColor(60).setLineWidth(0.3)
      const ancho = Math.min(70, (W - 2 * M - 10) / 2)
      doc.line(M, base, M + ancho, base)
      doc.line(W - M - ancho, base, W - M, base)
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60)
      doc.text('Firma del cliente', M, base + 4)
      doc.text('Aclaración / C.I. o RUC', W - M - ancho, base + 4)
      doc.setFontSize(7.5).setTextColor(120)
      doc.text(`Conforme con el pedido ${enc.folio}. Fecha: ____ / ____ / ________`, M, base - 5)
    }
    doc.setFontSize(8).setTextColor(130)
    doc.text(`${enc.folio} · Página ${p} de ${paginas}`, W - M, H - 6, { align: 'right' })
  }

  doc.save(nombreArchivo(enc.folio, 'pdf'))
}

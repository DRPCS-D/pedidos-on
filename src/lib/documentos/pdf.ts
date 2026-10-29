import { formatFecha } from '@/lib/format'
import { filasDoc, nombreArchivo, type EncabezadoDoc, type LineaDoc, type OpcionesDoc } from './filas'

const ent = (n: number) => n.toLocaleString('es-PY', { maximumFractionDigits: 0 })
const usd = (n: number) => n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

/** Genera y descarga el PDF de un pedido. jsPDF se carga recién al pedirlo (pesa bastante). */
export async function descargarPdf(enc: EncabezadoDoc, lineas: LineaDoc[], opc: OpcionesDoc): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), cargarLogo()])

  const filas = filasDoc(lineas)
  const verUsd = opc.precios !== 'ninguno' && (opc.precios === 'costo' || opc.moneda !== 'gs')
  const verGs = opc.precios === 'venta' && opc.moneda !== 'usd'
  const horizontal = verUsd && verGs
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

  // Tabla
  const cabecera = ['Código', 'Descripción', 'Color', 'Tamaños', 'Cajas', 'Cant.']
  if (opc.precios !== 'ninguno') {
    if (verUsd) cabecera.push(opc.precios === 'costo' ? 'Costo USD' : 'Precio USD', 'Subtotal USD')
    if (verGs) cabecera.push('Precio Gs', 'Subtotal Gs')
  }
  const precioUsd = (f: (typeof filas)[number]) => (opc.precios === 'costo' ? f.precioCosto : f.precioVentaUsd)
  const cuerpo = filas.map((f) => {
    const r = [f.codigo, [f.descripcion, f.marca].filter(Boolean).join(' · '), f.color || '—', f.tamanos || '—', f.cajas ? ent(f.cajas) : '—', ent(f.cantidad)]
    if (verUsd) r.push(usd(precioUsd(f)), usd(precioUsd(f) * f.cantidad))
    if (verGs) r.push(ent(f.precioVentaGs), ent(f.precioVentaGs * f.cantidad))
    return r
  })
  const unidades = filas.reduce((s, f) => s + f.cantidad, 0)
  const totalUsd = filas.reduce((s, f) => s + precioUsd(f) * f.cantidad, 0)
  const totalGs = filas.reduce((s, f) => s + f.precioVentaGs * f.cantidad, 0)
  const pie = ['', '', '', '', 'Total', ent(unidades)]
  if (verUsd) pie.push('', usd(totalUsd))
  if (verGs) pie.push('', ent(totalGs))

  autoTable(doc, {
    startY: y,
    head: [cabecera],
    body: cuerpo,
    foot: [pie],
    showFoot: 'lastPage',
    margin: { left: M, right: M, bottom: reservaFirma + piePagina + 4 },
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [220, 220, 220], lineWidth: 0.1, valign: 'middle' },
    headStyles: { fillColor: [20, 20, 20], textColor: [245, 208, 0], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(cabecera.map((_, i) => [i, { halign: i >= 4 ? 'right' : 'left' }])),
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

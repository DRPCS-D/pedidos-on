import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useProductos } from '@/hooks/useProductos'
import { ejecutarConDatos } from '@/lib/ejecutar'
import { claveFoto, type EncabezadoDoc, type LineaDoc, type MonedaDoc } from '@/lib/documentos/filas'
import { fotoDeColor } from '@/lib/fotos'

type Formato = 'pdf' | 'xlsx'

/** Botón que abre las opciones del documento de un pedido y lo descarga en PDF o Excel. */
export function DescargarDocumento({
  tipo,
  encabezado,
  lineas,
}: {
  /** `fabrica` muestra costos; `cliente` muestra precios de venta, firma y condiciones. */
  tipo: 'fabrica' | 'cliente'
  encabezado: EncabezadoDoc
  lineas: LineaDoc[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [formato, setFormato] = useState<Formato>('pdf')
  const [moneda, setMoneda] = useState<MonedaDoc>('usd')
  const [precios, setPrecios] = useState(true)
  const [firma, setFirma] = useState(true)
  const [condiciones, setCondiciones] = useState(true)
  const [fotos, setFotos] = useState(true)
  const [generando, setGenerando] = useState(false)
  const { data: catalogoTamanos } = useCatalogo('tamanos')
  const { porId: productos } = useProductos()

  /** Foto de cada producto y color del pedido, como data URL (el PDF no puede leerlas de Drive directamente). */
  async function cargarFotos(): Promise<Map<string, string>> {
    const porDrive = new Map<string, string[]>()
    for (const l of lineas) {
      const id = fotoDeColor(productos.get(l.productoId), l.color)
      if (id) porDrive.set(id, [...new Set([...(porDrive.get(id) ?? []), claveFoto(l.productoId, l.color)])])
    }
    const resultado = new Map<string, string>()
    if (porDrive.size === 0) return resultado
    const { data } = await ejecutarConDatos<{ fotos: Record<string, { mime: string; data: string }> }>(
      'fotosDocumento',
      { driveIds: [...porDrive.keys()] },
      'No se pudieron cargar las fotos.',
    )
    for (const [driveId, f] of Object.entries(data?.fotos ?? {})) {
      for (const clave of porDrive.get(driveId) ?? []) resultado.set(clave, `data:${f.mime};base64,${f.data}`)
    }
    return resultado
  }

  async function descargar() {
    setGenerando(true)
    try {
      const opc = {
        precios: !precios ? ('ninguno' as const) : tipo === 'fabrica' ? ('costo' as const) : ('venta' as const),
        moneda,
        firma: tipo === 'cliente' && firma,
        condiciones: tipo === 'cliente' && condiciones,
        ordenTamanos: new Map(
          [...catalogoTamanos]
            .sort((a, b) => (a.grupo ?? '').localeCompare(b.grupo ?? '') || (a.orden ?? 0) - (b.orden ?? 0))
            .map((t, i) => [t.id, i] as const),
        ),
        fotos: formato === 'pdf' && fotos ? await cargarFotos() : undefined,
      }
      if (formato === 'pdf') await (await import('@/lib/documentos/pdf')).descargarPdf(encabezado, lineas, opc)
      else await (await import('@/lib/documentos/excel')).descargarExcel(encabezado, lineas, opc)
      setAbierto(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el documento.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setAbierto(true)}>
        <Download /> Descargar
      </Button>

      <Modal
        abierto={abierto}
        titulo={`Descargar ${encabezado.folio}`}
        descripcion={tipo === 'fabrica' ? 'Documento del pedido para enviar a la fábrica.' : 'Documento del pedido para el cliente.'}
        onCerrar={() => setAbierto(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={generando}>
              Cancelar
            </Button>
            <Button onClick={descargar} disabled={generando}>
              <Download /> {generando ? 'Generando…' : formato === 'pdf' ? 'Descargar PDF' : 'Descargar Excel'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Formato</p>
            <div className="flex gap-2">
              {(
                [
                  ['pdf', 'PDF'],
                  ['xlsx', 'Excel'],
                ] as const
              ).map(([v, etiqueta]) => (
                <Button key={v} variant={formato === v ? 'primary' : 'outline'} size="sm" onClick={() => setFormato(v)}>
                  {etiqueta}
                </Button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-foreground">
            <input type="checkbox" className="size-4 accent-primary" checked={precios} onChange={(e) => setPrecios(e.target.checked)} />
            {tipo === 'fabrica' ? 'Incluir costos (USD)' : 'Incluir precios'}
          </label>

          {formato === 'pdf' && (
            <label className="flex cursor-pointer items-center gap-2 text-foreground">
              <input type="checkbox" className="size-4 accent-primary" checked={fotos} onChange={(e) => setFotos(e.target.checked)} />
              Incluir la foto de cada producto
            </label>
          )}

          {tipo === 'cliente' && precios && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Moneda</p>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as MonedaDoc)}>
                <option value="usd">Dólares (USD)</option>
                <option value="gs">Guaraníes (Gs)</option>
                <option value="ambas">Ambas monedas</option>
              </Select>
              {moneda === 'ambas' && formato === 'pdf' && <p className="mt-1 text-xs text-muted-foreground">El PDF sale en hoja horizontal.</p>}
            </div>
          )}

          {tipo === 'cliente' && formato === 'pdf' && (
            <label className="flex cursor-pointer items-center gap-2 text-foreground">
              <input type="checkbox" className="size-4 accent-primary" checked={firma} onChange={(e) => setFirma(e.target.checked)} />
              Espacio de firma del cliente en todas las hojas
            </label>
          )}
          {tipo === 'cliente' && (
            <label className="flex cursor-pointer items-center gap-2 text-foreground">
              <input type="checkbox" className="size-4 accent-primary" checked={condiciones} onChange={(e) => setCondiciones(e.target.checked)} />
              Incluir condiciones
              {!encabezado.condiciones.trim() && <span className="text-xs text-muted-foreground">(sin definir en Catálogos)</span>}
            </label>
          )}
        </div>
      </Modal>
    </>
  )
}

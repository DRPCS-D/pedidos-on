import { Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { usePedidos, type DatosLinea } from '@/hooks/usePedidos'
import { useProductos } from '@/hooks/useProductos'
import { formatGs, formatUsd, hoyIso, normalizar } from '@/lib/format'
import { totalesLineas } from '@/lib/pedidos'
import type { Pedido, Producto } from '@/lib/tipos'

/** Línea en edición: los números son texto para poder escribir «1,» sin que se pierda. */
interface LineaForm {
  clave: string
  id: string
  productoId: string
  codigo: string
  descripcion: string
  detalle: string
  cantidad: string
  precioCosto: string
  precioVentaUsd: string
  precioVentaGs: string
  cargado: number
}

const num = (s: string) => Number(s.replace(',', '.')) || 0
const texto = (n: number) => (n ? String(n) : '')

export function PedidoFormModal({
  abierto,
  pedido,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** null = crear */
  pedido: Pedido | null
  onCerrar: () => void
  /** Recibe el id del pedido guardado, para ir a su detalle. */
  onGuardado: (id: string) => void
}) {
  const { data: proveedores } = useCatalogo('proveedores')
  const { data: clientes } = useCatalogo('clientes')
  const { data: productos } = useProductos()
  const { guardar, refetch } = usePedidos()

  const [proveedorId, setProveedorId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoyIso())
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaForm[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setProveedorId(pedido?.proveedorId ?? '')
    setClienteId(pedido?.clienteId ?? '')
    setFecha(pedido?.fechaPedido || hoyIso())
    setNotas(pedido?.notas ?? '')
    setLineas(
      (pedido?.lineas ?? []).map((l) => ({
        clave: l.id,
        id: l.id,
        productoId: l.productoId,
        codigo: l.codigo,
        descripcion: l.descripcion,
        detalle: [l.color, l.marca, l.tamano].filter(Boolean).join(' · '),
        cantidad: texto(l.cantidad),
        precioCosto: texto(l.precioCosto),
        precioVentaUsd: texto(l.precioVentaUsd),
        precioVentaGs: texto(l.precioVentaGs),
        cargado: l.cargado,
      })),
    )
    setBusqueda('')
    setError(null)
    // Solo al abrir o cambiar de pedido: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, pedido?.id])

  const { nombres: marcas } = useCatalogo('marcas')
  const { nombres: tamanos } = useCatalogo('tamanos')

  /** Productos activos que coinciden; los de la fábrica elegida salen primero. */
  const sugeridos = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return []
    return productos
      .filter((p) => p.activo && normalizar(`${p.codigo} ${p.descripcion} ${p.color}`).includes(q))
      .sort((a, b) => Number(b.proveedorId === proveedorId) - Number(a.proveedorId === proveedorId))
      .slice(0, 8)
  }, [productos, busqueda, proveedorId])

  function agregar(p: Producto) {
    if (lineas.some((l) => l.productoId === p.id)) {
      toast.info(`${p.codigo} ya está en el pedido.`)
      return
    }
    setLineas([
      ...lineas,
      {
        clave: `n${Date.now()}`,
        id: '',
        productoId: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        detalle: [p.color, marcas.get(p.marcaId), tamanos.get(p.tamanoId)].filter(Boolean).join(' · '),
        cantidad: '1',
        precioCosto: texto(p.precioCosto),
        precioVentaUsd: texto(p.precioVentaUsd),
        precioVentaGs: texto(p.precioVentaGs),
        cargado: 0,
      },
    ])
    setBusqueda('')
  }

  const cambiar = (clave: string, campo: keyof LineaForm, valor: string) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)))

  const totales = totalesLineas(
    lineas.map((l) => ({
      cantidad: num(l.cantidad),
      precioCosto: num(l.precioCosto),
      precioVentaUsd: num(l.precioVentaUsd),
      precioVentaGs: num(l.precioVentaGs),
    })),
  )

  async function onGuardar() {
    if (!proveedorId) return setError('Elige la fábrica (proveedor).')
    if (!fecha) return setError('Indica la fecha del pedido.')
    if (lineas.length === 0) return setError('Agrega al menos un producto.')
    for (const l of lineas) {
      if (!(num(l.cantidad) > 0)) return setError(`${l.codigo}: la cantidad debe ser mayor que cero.`)
      if (num(l.cantidad) < l.cargado) return setError(`${l.codigo}: ya hay ${l.cargado} cargados en contenedores.`)
    }
    setGuardando(true)
    setError(null)
    const datosLineas: DatosLinea[] = lineas.map((l) => ({
      id: l.id,
      productoId: l.productoId,
      cantidad: num(l.cantidad),
      precioCosto: num(l.precioCosto),
      precioVentaUsd: num(l.precioVentaUsd),
      precioVentaGs: num(l.precioVentaGs),
    }))
    const { error: err, data } = await guardar(pedido?.id ?? null, {
      proveedorId,
      clienteId,
      fechaPedido: fecha,
      notas: notas.trim(),
      lineas: datosLineas,
    })
    setGuardando(false)
    if (err || !data) return setError(err ?? 'No se pudo guardar el pedido.')
    toast.success(pedido ? 'Pedido actualizado.' : `Pedido ${data.folio} creado.`)
    refetch()
    onGuardado(data.id)
  }

  const celda = 'h-8 px-2 text-right text-xs'

  return (
    <Modal
      abierto={abierto}
      titulo={pedido ? `Editar ${pedido.folio}` : 'Nuevo pedido a fábrica'}
      onCerrar={onCerrar}
      ancho="max-w-5xl"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : pedido ? 'Guardar' : 'Crear pedido'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Fábrica (proveedor) *">
            <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Elegir…</option>
              {proveedores
                .filter((p) => p.activo || p.id === proveedorId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Cliente" hint="Vacío = stock propio.">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Sin cliente</option>
              {clientes
                .filter((c) => c.activo || c.id === clienteId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Fecha del pedido *">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Notas" className="sm:col-span-1">
            <Textarea className="min-h-9.5" rows={1} value={notas} maxLength={2000} onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Productos</h3>
          <div className="relative mb-3 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar producto"
              className="pl-9"
              placeholder="Buscar producto por código, descripción o color para agregarlo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda.trim() && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {sugeridos.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias.</li>
                ) : (
                  sugeridos.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => agregar(p)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">{p.codigo}</span>{' '}
                          <span className="text-muted-foreground">{p.descripcion}</span>
                        </span>
                        <Plus className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {lineas.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Aún no hay productos. Búscalos arriba para agregarlos.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="w-24 px-2 py-2 text-right font-medium">Cantidad</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Costo USD</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Venta USD</th>
                    <th className="w-32 px-2 py-2 text-right font-medium">Venta Gs</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.clave} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-foreground">{l.codigo}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.descripcion}
                          {l.detalle && ` · ${l.detalle}`}
                        </p>
                        {l.cargado > 0 && (
                          <p className="text-xs text-warning">{l.cargado} ya cargados en contenedores</p>
                        )}
                      </td>
                      {(['cantidad', 'precioCosto', 'precioVentaUsd', 'precioVentaGs'] as const).map((campo) => (
                        <td key={campo} className="px-2 py-1.5">
                          <Input
                            inputMode="decimal"
                            aria-label={`${campo} de ${l.codigo}`}
                            className={celda}
                            value={l[campo]}
                            onChange={(e) => cambiar(l.clave, campo, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title={l.cargado > 0 ? 'Está cargado en un contenedor' : 'Quitar'}
                          disabled={l.cargado > 0}
                          onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                        >
                          <X />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-secondary/40 text-xs">
                    <td className="px-3 py-2 font-medium text-foreground">{totales.unidades.toLocaleString('es-PY')} unidades</td>
                    <td></td>
                    <td className="tabular px-2 py-2 text-right font-medium text-foreground">{formatUsd(totales.costo)}</td>
                    <td className="tabular px-2 py-2 text-right font-medium text-foreground">{formatUsd(totales.ventaUsd)}</td>
                    <td className="tabular px-2 py-2 text-right font-medium text-foreground">{formatGs(totales.ventaGs)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Los precios se copian del producto al agregarlo; si luego cambian en el catálogo, este pedido no se altera.
          </p>
        </div>

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

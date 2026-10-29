import { ArrowLeft, ArrowRight, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Adjuntos } from '@/components/archivos/Adjuntos'
import { BadgeCarga, BadgeEstadoContenedor, BadgeEstadoPedido } from '@/components/pedidos/badges'
import { CambiarEstadoModal } from '@/components/pedidos/CambiarEstadoModal'
import { LineaDeTiempo } from '@/components/pedidos/LineaDeTiempo'
import { PedidoFormModal } from '@/components/pedidos/PedidoFormModal'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { DescargarDocumento } from '@/components/documentos/DescargarDocumento'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useConfig } from '@/hooks/useConfig'
import { useContenedores } from '@/hooks/useContenedores'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { formatCantidad, formatFecha, formatGs, formatUsd } from '@/lib/format'
import {
  agruparPorColor,
  CARGA_LABEL,
  cargaDePedido,
  estadosManualesPermitidos,
  siguienteEstadoManual,
  tieneCargas,
  totalesLineas,
} from '@/lib/pedidos'
import { ESTADO_PEDIDO_LABEL, type EstadoPedido } from '@/lib/tipos'

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

export default function PedidoDetalle() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { esAdmin, puedeEditar } = useAuth()
  const { porId, loading, error, refetch, cambiarEstado, borrar, deshacerEstado } = usePedidos()
  const { data: proveedores, nombres: nombreProveedor } = useCatalogo('proveedores')
  const { empresa } = useConfig()
  const { nombres: nombreCliente } = useCatalogo('clientes')
  const { data: pedidosCliente } = usePedidosCliente()
  const { data: contenedores } = useContenedores()

  const pedido = porId.get(id)
  const [editando, setEditando] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [confirmando, setConfirmando] = useState<'borrar' | 'deshacer' | null>(null)
  const [procesando, setProcesando] = useState(false)

  const t = useMemo(() => (pedido ? totalesLineas(pedido.lineas) : null), [pedido])
  /** Pedidos de cliente que se abastecen de este pedido, con las unidades de cada uno. */
  const clientesDelPedido = useMemo(() => {
    if (!pedido) return []
    return pedidosCliente
      .map((c) => ({
        ...c,
        unidades: c.lineas.reduce((s, l) => s + l.asignaciones.filter((a) => a.pedidoId === pedido.id).reduce((n, a) => n + a.cantidad, 0), 0),
      }))
      .filter((c) => c.unidades > 0 && c.estado !== 'cancelado')
  }, [pedidosCliente, pedido])
  const enContenedores = useMemo(() => {
    if (!pedido) return []
    return contenedores
      .map((c) => ({ c, unidades: c.cargas.filter((x) => x.pedidoId === pedido.id).reduce((s, x) => s + x.cantidad, 0) }))
      .filter((x) => x.unidades > 0)
  }, [contenedores, pedido])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error) return <ErrorBox mensaje={error} />
  if (!pedido || !t) {
    return (
      <Vacio
        titulo="No se encontró el pedido"
        descripcion="Pudo haberse borrado."
        accion={
          <Button variant="outline" onClick={() => navigate('/pedidos')}>
            Volver a pedidos
          </Button>
        }
      />
    )
  }

  const carga = cargaDePedido(pedido)
  const asignadoTotal = pedido.lineas.reduce((s, l) => s + l.asignado, 0)
  const permitidos = estadosManualesPermitidos(pedido.estado, tieneCargas(pedido))
  const siguiente = siguienteEstadoManual(pedido.estado)
  const abierto = pedido.estado !== 'cancelado' && pedido.estado !== 'entregado'
  const sinCargado = pedido.lineas.reduce((s, l) => s + l.cargado, 0) === 0

  async function ejecutarConfirmado() {
    if (!pedido || !confirmando) return
    setProcesando(true)
    const { error: err } = confirmando === 'borrar' ? await borrar(pedido.id) : await deshacerEstado(pedido.id)
    setProcesando(false)
    if (err) return toast.error(err)
    refetch()
    if (confirmando === 'borrar') {
      toast.success('Pedido borrado.')
      navigate('/pedidos', { replace: true })
    } else toast.success('Se deshizo el último cambio de estado.')
    setConfirmando(null)
  }

  return (
    <div className="space-y-6">
      <Link to="/pedidos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pedidos
      </Link>

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-lg font-semibold text-foreground">
              {pedido.folio}
              <BadgeEstadoPedido estado={pedido.estado} />
              {carga === 'parcial' && <BadgeCarga carga={carga} />}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Creado por {pedido.creadoNombre || pedido.creadoPor} · en este estado desde {formatFecha(pedido.fechaEstado)}
            </p>
            <DescargarDocumento
              tipo="fabrica"
              lineas={pedido.lineas}
              encabezado={{
                titulo: 'PEDIDO A FÁBRICA',
                folio: pedido.folio,
                fecha: pedido.fechaPedido,
                contraparteTitulo: 'Fábrica',
                contraparte: (() => {
                  const f = proveedores.find((x) => x.id === pedido.proveedorId)
                  return f ? [f.nombre, f.contacto, f.ciudad, [f.telefono, f.email].filter(Boolean).join(' · ')] : []
                })(),
                notas: pedido.notas,
                empresa,
                condiciones: '',
              }}
            />
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              {siguiente && permitidos.includes(siguiente) && (
                <Button onClick={() => setCambiando(true)}>
                  Avanzar a {ESTADO_PEDIDO_LABEL[siguiente]} <ArrowRight />
                </Button>
              )}
              {permitidos.length > 0 && (
                <Button variant="outline" onClick={() => setCambiando(true)}>
                  Cambiar estado
                </Button>
              )}
              {abierto && (
                <Button variant="outline" onClick={() => setEditando(true)}>
                  <Pencil /> Editar
                </Button>
              )}
            </div>
          )}
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Fábrica">{nombreProveedor.get(pedido.proveedorId) ?? '—'}</Dato>
          <Dato label="Asignado a clientes">
            {formatCantidad(asignadoTotal)} de {formatCantidad(t.unidades)} unid.
            {asignadoTotal < t.unidades && (
              <span className="text-muted-foreground"> · stock {formatCantidad(t.unidades - asignadoTotal)}</span>
            )}
          </Dato>
          <Dato label="Fecha del pedido">{formatFecha(pedido.fechaPedido)}</Dato>
          <Dato label="Carga en contenedores">{CARGA_LABEL[carga]}</Dato>
        </dl>
        {pedido.notas && <p className="mt-4 whitespace-pre-line rounded-md bg-secondary/60 px-3 py-2 text-sm text-foreground">{pedido.notas}</p>}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">Productos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Código</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Color</th>
                <th className="px-4 py-2.5 font-medium">Marca</th>
                <th className="px-4 py-2.5 text-right font-medium">Por caja</th>
                <th className="px-4 py-2.5 text-right font-medium">Cajas</th>
                <th className="px-4 py-2.5 text-right font-medium">Cant.</th>
                <th className="px-4 py-2.5 text-right font-medium">Cargado</th>
                <th className="px-4 py-2.5 text-right font-medium">Costo</th>
                <th className="px-4 py-2.5 text-right font-medium">Venta USD</th>
                <th className="px-4 py-2.5 text-right font-medium">Venta Gs</th>
              </tr>
            </thead>
            <tbody>
              {agruparPorColor(pedido.lineas).map((g) => {
                const l = g.lineas[0]
                const cargado = g.lineas.reduce((s, x) => s + x.cargado, 0)
                return (
                <tr key={g.clave} title={g.tamanos || undefined} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{l.codigo}</td>
                  <td className="px-4 py-2.5 text-foreground">{l.descripcion}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.color || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.marca || '—'}</td>
                  <td className="tabular px-4 py-2.5 text-right text-muted-foreground">{g.cajas > 0 ? formatCantidad(g.porCaja) : '—'}</td>
                  <td className="tabular px-4 py-2.5 text-right text-muted-foreground">{g.cajas > 0 ? formatCantidad(g.cajas) : '—'}</td>
                  <td className="tabular px-4 py-2.5 text-right text-foreground">{formatCantidad(g.cantidad)}</td>
                  <td
                    className={`tabular px-4 py-2.5 text-right ${cargado >= g.cantidad ? 'text-success' : cargado > 0 ? 'text-warning' : 'text-muted-foreground'}`}
                  >
                    {formatCantidad(cargado)}
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">{formatUsd(l.precioCosto)}</td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-foreground">{formatUsd(l.precioVentaUsd)}</td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-foreground">{formatGs(l.precioVentaGs)}</td>
                </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/40 text-xs font-medium text-foreground">
                <td className="px-4 py-2.5" colSpan={4}>
                  Total
                </td>
                <td></td>
                <td></td>
                <td className="tabular px-4 py-2.5 text-right">{formatCantidad(t.unidades)}</td>
                <td></td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right">{formatUsd(t.costo)}</td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right">{formatUsd(t.ventaUsd)}</td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right">{formatGs(t.ventaGs)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Contenedores</h2>
          {enContenedores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todavía no está cargado en ningún contenedor.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {enContenedores.map(({ c, unidades }) => (
                <li key={c.id}>
                  <Link to={`/contenedores/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent/40">
                    <span className="font-medium text-foreground">{c.numero}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCantidad(unidades)} unid. · ETA {formatFecha(c.eta)}
                    </span>
                    <BadgeEstadoContenedor estado={c.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Historial de estados</h2>
            {esAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmando('deshacer')}>
                <RotateCcw /> Deshacer último
              </Button>
            )}
          </div>
          <LineaDeTiempo entidad="pedido" id={pedido.id} etiquetas={ESTADO_PEDIDO_LABEL} />
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Clientes</h2>
        {clientesDelPedido.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no está asignado a ningún cliente: todo es stock propio.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {clientesDelPedido.map((c) => (
              <li key={c.id}>
                <Link to={`/pedidos-cliente/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent/40">
                  <span className="font-medium text-foreground">{c.folio}</span>
                  <span className="text-muted-foreground">{nombreCliente.get(c.clienteId) ?? '—'}</span>
                  <span className="tabular text-xs text-foreground">{formatCantidad(c.unidades)} unid.</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Documentos</h2>
        <p className="mb-3 text-xs text-muted-foreground">Proforma, factura, packing list y cualquier otro archivo del pedido (se guardan en Drive).</p>
        <Adjuntos entidad="pedido" id={pedido.id} puedeEditar={puedeEditar} />
      </section>

      {esAdmin && pedido.estado === 'cancelado' && sinCargado && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setConfirmando('borrar')}>
            <Trash2 className="text-destructive" /> Borrar pedido
          </Button>
        </div>
      )}

      <PedidoFormModal
        abierto={editando}
        pedido={pedido}
        onCerrar={() => setEditando(false)}
        onGuardado={() => setEditando(false)}
      />

      <CambiarEstadoModal
        abierto={cambiando}
        titulo={`Cambiar estado de ${pedido.folio}`}
        descripcion={
          permitidos.length === 0
            ? undefined
            : 'Los estados de embarque (embarcado, en tránsito…) los pone el contenedor en el que viaja.'
        }
        opciones={permitidos.map((e: EstadoPedido) => ({ valor: e, label: ESTADO_PEDIDO_LABEL[e] }))}
        inicial={siguiente ?? undefined}
        onCerrar={() => setCambiando(false)}
        onConfirmar={(estado, fecha, nota) => cambiarEstado(pedido.id, estado as EstadoPedido, fecha, nota)}
        onHecho={() => {
          setCambiando(false)
          refetch()
        }}
      />

      <ConfirmModal
        abierto={confirmando !== null}
        titulo={confirmando === 'borrar' ? 'Borrar pedido' : 'Deshacer último cambio'}
        textoConfirmar={confirmando === 'borrar' ? 'Borrar' : 'Deshacer'}
        procesando={procesando}
        mensaje={
          confirmando === 'borrar' ? (
            <>Se borrará <strong>{pedido.folio}</strong> con sus productos, historial y documentos. No se puede deshacer.</>
          ) : (
            <>Se quita el último cambio de estado de <strong>{pedido.folio}</strong> y vuelve al anterior. Si ese estado lo puso un contenedor, deshazlo desde el contenedor.</>
          )
        }
        onCancelar={() => setConfirmando(null)}
        onConfirmar={ejecutarConfirmado}
      />
    </div>
  )
}

import { ArrowLeft, Link2, Pencil, RotateCcw, Trash2, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BadgeEstadoPedido } from '@/components/pedidos/badges'
import { CambiarEstadoModal } from '@/components/pedidos/CambiarEstadoModal'
import { FotoColor } from '@/components/productos/FotoColor'
import { CambiosPrecio } from '@/components/pedidos/CambiosPrecio'
import { LineaDeTiempo } from '@/components/pedidos/LineaDeTiempo'
import { AsignarModal } from '@/components/pedidosCliente/AsignarModal'
import { BadgeSituacion } from '@/components/pedidosCliente/badges'
import { PedidoClienteFormModal } from '@/components/pedidosCliente/PedidoClienteFormModal'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { DescargarDocumento } from '@/components/documentos/DescargarDocumento'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useConfig } from '@/hooks/useConfig'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { formatCantidad, formatFecha, formatGs, formatUsd } from '@/lib/format'
import { agruparPorColor, totalesLineas } from '@/lib/pedidos'
import { COBERTURA_LABEL, situacionDe } from '@/lib/pedidoCliente'
import { ESTADO_PC_LABEL, type EstadoPedidoCliente } from '@/lib/tipos'

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

export default function PedidoClienteDetalle() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { esAdmin, puedeEditar } = useAuth()
  const { porId, loading, error, refetch, asignarAutomatico, cambiarEstado, borrar, deshacerEstado } = usePedidosCliente()
  const { porId: pedidos, refetch: refetchPedidos } = usePedidos()
  const { data: clientes, nombres: nombreCliente } = useCatalogo('clientes')
  const { empresa, condiciones } = useConfig()

  const pc = porId.get(id)
  const [editando, setEditando] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [confirmando, setConfirmando] = useState<'borrar' | 'deshacer' | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [autoAsignando, setAutoAsignando] = useState(false)

  const t = useMemo(() => (pc ? totalesLineas(pc.lineas) : null), [pc])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error) return <ErrorBox mensaje={error} />
  if (!pc || !t) {
    return (
      <Vacio
        titulo="No se encontró el pedido"
        descripcion="Pudo haberse borrado."
        accion={
          <Button variant="outline" onClick={() => navigate('/pedidos-cliente')}>
            Volver a pedidos de clientes
          </Button>
        }
      />
    )
  }

  const s = situacionDe(pc, pedidos)
  const abierto = pc.estado === 'registrado'
  const opciones = (['registrado', 'entregado', 'cancelado'] as EstadoPedidoCliente[])
    .filter((e) => e !== pc.estado)
    .map((e) => ({ valor: e, label: ESTADO_PC_LABEL[e] }))

  async function asignarDisponible() {
    if (!pc) return
    setAutoAsignando(true)
    const { error: err, data } = await asignarAutomatico(pc.id)
    setAutoAsignando(false)
    if (err) return toast.error(err)
    toast.success(data?.asignado ? `${formatCantidad(data.asignado)} unidades asignadas.` : 'No hay nada disponible para asignar.')
    refetch()
    refetchPedidos()
  }

  async function ejecutarConfirmado() {
    if (!pc || !confirmando) return
    setProcesando(true)
    const { error: err } = confirmando === 'borrar' ? await borrar(pc.id) : await deshacerEstado(pc.id)
    setProcesando(false)
    if (err) return toast.error(err)
    refetch()
    refetchPedidos()
    if (confirmando === 'borrar') {
      toast.success('Pedido borrado.')
      navigate('/pedidos-cliente', { replace: true })
    } else toast.success('Se deshizo el último cambio de estado.')
    setConfirmando(null)
  }

  return (
    <div className="space-y-6">
      <Link to="/pedidos-cliente" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pedidos de clientes
      </Link>

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-lg font-semibold text-foreground">
              {pc.folio}
              <BadgeSituacion pedido={pc} pedidos={pedidos} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Creado por {pc.creadoNombre || pc.creadoPor} · en este estado desde {formatFecha(pc.fechaEstado)}
            </p>
            <DescargarDocumento
              tipo="cliente"
              lineas={pc.lineas}
              encabezado={{
                titulo: 'PEDIDO DE CLIENTE',
                folio: pc.folio,
                fecha: pc.fecha,
                contraparteTitulo: 'Cliente',
                contraparte: (() => {
                  const c = clientes.find((x) => x.id === pc.clienteId)
                  return c ? [c.nombre, c.ruc && `RUC / C.I.: ${c.ruc}`, c.direccion, [c.telefono, c.email].filter(Boolean).join(' · ')] : []
                })(),
                notas: pc.notas,
                empresa,
                condiciones,
              }}
            />
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              {abierto && s.cobertura !== 'completa' && (
                <Button onClick={asignarDisponible} disabled={autoAsignando}>
                  <Wand2 /> {autoAsignando ? 'Asignando…' : 'Asignar lo disponible'}
                </Button>
              )}
              {abierto && (
                <Button variant="outline" onClick={() => setAsignando(true)}>
                  <Link2 /> Asignar a mano
                </Button>
              )}
              <Button variant="outline" onClick={() => setCambiando(true)}>
                Cambiar estado
              </Button>
              {abierto && (
                <Button variant="outline" onClick={() => setEditando(true)}>
                  <Pencil /> Editar
                </Button>
              )}
            </div>
          )}
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Cliente">{nombreCliente.get(pc.clienteId) ?? '—'}</Dato>
          <Dato label="Fecha del pedido">{formatFecha(pc.fecha)}</Dato>
          <Dato label="Cubierto desde fábricas">
            {formatCantidad(s.asignado)} de {formatCantidad(s.pedido)} unid. · {COBERTURA_LABEL[s.cobertura]}
          </Dato>
          <Dato label="Total de venta">
            {formatUsd(t.ventaUsd)} <span className="text-muted-foreground">/ {formatGs(t.ventaGs)}</span>
          </Dato>
        </dl>
        {pc.notas && <p className="mt-4 whitespace-pre-line rounded-md bg-secondary/60 px-3 py-2 text-sm text-foreground">{pc.notas}</p>}
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
                <th className="px-4 py-2.5 text-right font-medium">Por caja</th>
                <th className="px-4 py-2.5 text-right font-medium">Cajas</th>
                <th className="px-4 py-2.5 text-right font-medium">Cant.</th>
                <th className="px-4 py-2.5 text-right font-medium">Cubierto</th>
                <th className="px-4 py-2.5 font-medium">Viene de</th>
                <th className="px-4 py-2.5 text-right font-medium">Venta USD</th>
                <th className="px-4 py-2.5 text-right font-medium">Venta Gs</th>
              </tr>
            </thead>
            <tbody>
              {agruparPorColor(pc.lineas).map((g) => {
                const l = g.lineas[0]
                const asignado = g.lineas.reduce((s, x) => s + x.asignado, 0)
                // De dónde viene: suma por pedido a fábrica, sin repetirlo por cada tamaño.
                const origen = new Map<string, number>()
                for (const x of g.lineas) for (const a of x.asignaciones) origen.set(a.pedidoId, (origen.get(a.pedidoId) ?? 0) + a.cantidad)
                return (
                <tr key={g.clave} title={g.tamanos || undefined} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{l.codigo}</td>
                  <td className="px-4 py-2.5 text-foreground">{l.descripcion}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <FotoColor productoId={l.productoId} color={l.color} />
                      {l.color || '—'}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-muted-foreground">{g.cajas > 0 ? formatCantidad(g.porCaja) : '—'}</td>
                  <td className="tabular px-4 py-2.5 text-right text-muted-foreground">{g.cajas > 0 ? formatCantidad(g.cajas) : '—'}</td>
                  <td className="tabular px-4 py-2.5 text-right text-foreground">{formatCantidad(g.cantidad)}</td>
                  <td
                    className={`tabular px-4 py-2.5 text-right ${asignado >= g.cantidad ? 'text-success' : asignado > 0 ? 'text-warning' : 'text-muted-foreground'}`}
                  >
                    {formatCantidad(asignado)}
                  </td>
                  <td className="px-4 py-2.5">
                    {origen.size === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin pedir</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {[...origen.entries()].map(([pedidoId, cantidad]) => {
                          const p = pedidos.get(pedidoId)
                          return (
                            <span key={pedidoId} className="flex items-center gap-1.5 text-xs">
                              <Link to={`/pedidos/${pedidoId}`} className="font-medium text-foreground hover:underline">
                                {p?.folio ?? '—'}
                              </Link>
                              <span className="tabular text-muted-foreground">×{formatCantidad(cantidad)}</span>
                              {p && <BadgeEstadoPedido estado={p.estado} />}
                            </span>
                          )
                        })}
                      </span>
                    )}
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-foreground">{formatUsd(l.precioVentaUsd)}</td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-foreground">{formatGs(l.precioVentaGs)}</td>
                </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/40 text-xs font-medium text-foreground">
                <td className="px-4 py-2.5" colSpan={5}>
                  Total
                </td>
                <td className="tabular px-4 py-2.5 text-right">{formatCantidad(t.unidades)}</td>
                <td className="tabular px-4 py-2.5 text-right">{formatCantidad(s.asignado)}</td>
                <td></td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right">{formatUsd(t.ventaUsd)}</td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right">{formatGs(t.ventaGs)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <CambiosPrecio entidad="pedidoCliente" id={pc.id} />

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Historial</h2>
          {esAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmando('deshacer')}>
              <RotateCcw /> Deshacer último
            </Button>
          )}
        </div>
        <LineaDeTiempo entidad="pedidoCliente" id={pc.id} etiquetas={ESTADO_PC_LABEL} />
        <p className="mt-4 text-xs text-muted-foreground">
          Dónde está lo que pidió el cliente lo dan los pedidos a fábrica que lo abastecen (columna «Viene de»): sigue su estado y sus contenedores.
        </p>
      </section>

      {esAdmin && pc.estado === 'cancelado' && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setConfirmando('borrar')}>
            <Trash2 className="text-destructive" /> Borrar pedido
          </Button>
        </div>
      )}

      <PedidoClienteFormModal
        abierto={editando}
        pedido={pc}
        onCerrar={() => setEditando(false)}
        onGuardado={() => {
          setEditando(false)
          refetchPedidos()
        }}
      />

      <AsignarModal abierto={asignando} pedido={pc} onCerrar={() => setAsignando(false)} onGuardado={() => setAsignando(false)} />

      <CambiarEstadoModal
        abierto={cambiando}
        titulo={`Cambiar estado de ${pc.folio}`}
        descripcion="«Cancelado» libera lo asignado desde pedidos a fábrica para otros clientes."
        opciones={opciones}
        inicial={pc.estado === 'registrado' ? 'entregado' : 'registrado'}
        onCerrar={() => setCambiando(false)}
        onConfirmar={(estado, fecha, nota) => cambiarEstado(pc.id, estado as EstadoPedidoCliente, fecha, nota)}
        onHecho={() => {
          setCambiando(false)
          refetch()
          refetchPedidos()
        }}
      />

      <ConfirmModal
        abierto={confirmando !== null}
        titulo={confirmando === 'borrar' ? 'Borrar pedido' : 'Deshacer último cambio'}
        textoConfirmar={confirmando === 'borrar' ? 'Borrar' : 'Deshacer'}
        procesando={procesando}
        mensaje={
          confirmando === 'borrar' ? (
            <>Se borrará <strong>{pc.folio}</strong> con sus productos y su historial. No se puede deshacer.</>
          ) : (
            <>Se quita el último cambio de estado de <strong>{pc.folio}</strong> y vuelve al anterior (las asignaciones liberadas al cancelar no se restauran).</>
          )
        }
        onCancelar={() => setConfirmando(null)}
        onConfirmar={ejecutarConfirmado}
      />
    </div>
  )
}

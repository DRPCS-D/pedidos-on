import { ArrowLeft, ArrowRight, PackagePlus, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CargaModal } from '@/components/contenedores/CargaModal'
import { ContenedorFormModal } from '@/components/contenedores/ContenedorFormModal'
import { BadgeEstadoContenedor, BadgeEstadoPedido } from '@/components/pedidos/badges'
import { CambiarEstadoModal } from '@/components/pedidos/CambiarEstadoModal'
import { LineaDeTiempo } from '@/components/pedidos/LineaDeTiempo'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useContenedores } from '@/hooks/useContenedores'
import { usePedidos } from '@/hooks/usePedidos'
import { formatCantidad, formatFecha } from '@/lib/format'
import {
  ESTADO_CONTENEDOR_LABEL,
  ESTADOS_CONTENEDOR,
  TIPO_CONTENEDOR_LABEL,
  type EstadoContenedor,
  type Pedido,
} from '@/lib/tipos'

/** Junta las cargas de un pedido por producto y color (una fila por color, con los tamaños sumados). */
function porColor(pedido: Pedido | undefined, cargas: { lineaId: string; cantidad: number }[]) {
  const grupos = new Map<string, { clave: string; codigo: string; texto: string; cargado: number; total: number; detalle: string[] }>()
  for (const { lineaId, cantidad } of cargas) {
    const l = pedido?.lineas.find((x) => x.id === lineaId)
    const clave = l ? `${l.productoId}|${l.color}` : lineaId
    const g = grupos.get(clave) ?? {
      clave,
      codigo: l?.codigo ?? '—',
      texto: l ? [l.descripcion, l.color].filter(Boolean).join(' · ') : '',
      cargado: 0,
      total: l && pedido ? pedido.lineas.filter((x) => x.productoId === l.productoId && x.color === l.color).reduce((t, x) => t + x.cantidad, 0) : 0,
      detalle: [],
    }
    g.cargado += cantidad
    if (l?.tamano) g.detalle.push(`${l.tamano}:${cantidad}`)
    grupos.set(clave, g)
  }
  return [...grupos.values()].map((g) => ({ ...g, detalle: g.detalle.join('  ') }))
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

export default function ContenedorDetalle() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { esAdmin, puedeEditar } = useAuth()
  const { porId, loading, error, refetch, cambiarEstado, borrar, deshacerEstado } = useContenedores()
  const { porId: pedidoPorId } = usePedidos()
  const { nombres: nombreProveedor } = useCatalogo('proveedores')

  const contenedor = porId.get(id)
  const [editando, setEditando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [confirmando, setConfirmando] = useState<'borrar' | 'deshacer' | null>(null)
  const [procesando, setProcesando] = useState(false)

  /** Lo que lleva, agrupado por pedido. */
  const porPedido = useMemo(() => {
    if (!contenedor) return []
    const grupos = new Map<string, { pedidoId: string; lineas: { lineaId: string; cantidad: number }[] }>()
    for (const c of contenedor.cargas) {
      const g = grupos.get(c.pedidoId) ?? { pedidoId: c.pedidoId, lineas: [] }
      g.lineas.push({ lineaId: c.lineaId, cantidad: c.cantidad })
      grupos.set(c.pedidoId, g)
    }
    return [...grupos.values()]
  }, [contenedor])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error) return <ErrorBox mensaje={error} />
  if (!contenedor) {
    return (
      <Vacio
        titulo="No se encontró el contenedor"
        descripcion="Pudo haberse borrado."
        accion={
          <Button variant="outline" onClick={() => navigate('/contenedores')}>
            Volver a contenedores
          </Button>
        }
      />
    )
  }

  const unidades = contenedor.cargas.reduce((s, x) => s + x.cantidad, 0)
  const idx = ESTADOS_CONTENEDOR.indexOf(contenedor.estado)
  const siguiente = ESTADOS_CONTENEDOR[idx + 1] as EstadoContenedor | undefined
  const vacio = contenedor.cargas.length === 0
  const opciones = ESTADOS_CONTENEDOR.filter((e) => e !== contenedor.estado && (e === 'preparando' || !vacio)).map((e) => ({
    valor: e,
    label: ESTADO_CONTENEDOR_LABEL[e],
  }))

  async function ejecutarConfirmado() {
    if (!contenedor || !confirmando) return
    setProcesando(true)
    const { error: err } = confirmando === 'borrar' ? await borrar(contenedor.id) : await deshacerEstado(contenedor.id)
    setProcesando(false)
    if (err) return toast.error(err)
    refetch()
    if (confirmando === 'borrar') {
      toast.success('Contenedor borrado.')
      navigate('/contenedores', { replace: true })
    } else toast.success('Se deshizo el último cambio de estado.')
    setConfirmando(null)
  }

  return (
    <div className="space-y-6">
      <Link to="/contenedores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Contenedores
      </Link>

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-lg font-semibold text-foreground">
              {contenedor.numero}
              <BadgeEstadoContenedor estado={contenedor.estado} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TIPO_CONTENEDOR_LABEL[contenedor.tipo]} · creado por {contenedor.creadoNombre || contenedor.creadoPor}
            </p>
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              {siguiente && !vacio && (
                <Button onClick={() => setCambiando(true)}>
                  Avanzar a {ESTADO_CONTENEDOR_LABEL[siguiente]} <ArrowRight />
                </Button>
              )}
              <Button variant="outline" onClick={() => setCambiando(true)}>
                Cambiar estado
              </Button>
              <Button variant="outline" onClick={() => setEditando(true)}>
                <Pencil /> Editar
              </Button>
            </div>
          )}
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Naviera">{contenedor.naviera || '—'}</Dato>
          <Dato label="BL">{contenedor.bl || '—'}</Dato>
          <Dato label="Origen → destino">
            {contenedor.puertoOrigen || contenedor.puertoDestino
              ? `${contenedor.puertoOrigen || '?'} → ${contenedor.puertoDestino || '?'}`
              : '—'}
          </Dato>
          <Dato label="Carga">
            {formatCantidad(unidades)} unid. en {porPedido.length} {porPedido.length === 1 ? 'pedido' : 'pedidos'}
          </Dato>
          <Dato label="Salida estimada (ETD)">{formatFecha(contenedor.etd)}</Dato>
          <Dato label="Llegada estimada (ETA)">{formatFecha(contenedor.eta)}</Dato>
        </dl>
        {contenedor.notas && (
          <p className="mt-4 whitespace-pre-line rounded-md bg-secondary/60 px-3 py-2 text-sm text-foreground">{contenedor.notas}</p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Carga</h2>
          {puedeEditar && contenedor.estado === 'preparando' && (
            <Button size="sm" onClick={() => setCargando(true)}>
              <PackagePlus /> {vacio ? 'Asignar carga' : 'Cambiar carga'}
            </Button>
          )}
        </div>
        {vacio ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            El contenedor está vacío.
            {puedeEditar && contenedor.estado === 'preparando' && ' Asigna productos de tus pedidos con «Asignar carga».'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {porPedido.map(({ pedidoId, lineas }) => {
              const p = pedidoPorId.get(pedidoId)
              return (
                <div key={pedidoId}>
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/40 px-5 py-2">
                    <p className="text-sm">
                      {p ? (
                        <Link to={`/pedidos/${p.id}`} className="font-semibold text-foreground hover:underline">
                          {p.folio}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">Pedido</span>
                      )}
                      <span className="text-muted-foreground">
                        {p && ` · ${nombreProveedor.get(p.proveedorId) ?? '—'}`}
                      </span>
                    </p>
                    {p && <BadgeEstadoPedido estado={p.estado} />}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {porColor(p, lineas).map((g) => (
                        <tr key={g.clave} title={g.detalle || undefined} className="border-t border-border first:border-0">
                          <td className="whitespace-nowrap px-5 py-2 font-medium text-foreground">{g.codigo}</td>
                          <td className="px-3 py-2 text-muted-foreground">{g.texto}</td>
                          <td className="tabular px-5 py-2 text-right text-foreground">
                            {formatCantidad(g.cargado)}
                            {g.cargado < g.total && <span className="text-xs text-muted-foreground"> de {formatCantidad(g.total)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
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
        <LineaDeTiempo entidad="contenedor" id={contenedor.id} etiquetas={ESTADO_CONTENEDOR_LABEL} />
        <p className="mt-4 text-xs text-muted-foreground">
          Al cambiar el estado del contenedor, sus pedidos pasan al mismo estado; si un pedido viaja en varios contenedores, toma el menos avanzado.
        </p>
      </section>

      {puedeEditar && vacio && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setConfirmando('borrar')}>
            <Trash2 className="text-destructive" /> Borrar contenedor
          </Button>
        </div>
      )}

      <ContenedorFormModal
        abierto={editando}
        contenedor={contenedor}
        onCerrar={() => setEditando(false)}
        onGuardado={() => setEditando(false)}
      />

      <CargaModal
        abierto={cargando}
        contenedor={contenedor}
        onCerrar={() => setCargando(false)}
        onGuardado={() => setCargando(false)}
      />

      <CambiarEstadoModal
        abierto={cambiando}
        titulo={`Cambiar estado de ${contenedor.numero}`}
        descripcion="Los pedidos que lleva se actualizan solos y la fecha queda en su historial."
        opciones={opciones}
        inicial={siguiente}
        onCerrar={() => setCambiando(false)}
        onConfirmar={(estado, fecha, nota) => cambiarEstado(contenedor.id, estado as EstadoContenedor, fecha, nota)}
        onHecho={() => {
          setCambiando(false)
          refetch()
        }}
      />

      <ConfirmModal
        abierto={confirmando !== null}
        titulo={confirmando === 'borrar' ? 'Borrar contenedor' : 'Deshacer último cambio'}
        textoConfirmar={confirmando === 'borrar' ? 'Borrar' : 'Deshacer'}
        procesando={procesando}
        mensaje={
          confirmando === 'borrar' ? (
            <>¿Borrar el contenedor <strong>{contenedor.numero}</strong>? No se puede deshacer.</>
          ) : (
            <>Se quita el último cambio de estado de <strong>{contenedor.numero}</strong> y se recalculan sus pedidos.</>
          )
        }
        onCancelar={() => setConfirmando(null)}
        onConfirmar={ejecutarConfirmado}
      />
    </div>
  )
}

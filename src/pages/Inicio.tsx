import { ClipboardList, Container, Factory, PackageSearch, Package, Settings2, Users, UserRound } from 'lucide-react'
import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeEstadoContenedor, BadgeEstadoPedido } from '@/components/pedidos/badges'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useContenedores } from '@/hooks/useContenedores'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { formatCantidad, formatFecha, hoyIso } from '@/lib/format'
import { cargaDePedido, totalesLineas } from '@/lib/pedidos'
import { pendientesDeClientes } from '@/lib/pedidoCliente'
import { ESTADO_PEDIDO_LABEL, ESTADOS_PEDIDO, ROL_LABEL, type EstadoPedido } from '@/lib/tipos'

interface Modulo {
  to: string
  titulo: string
  descripcion: string
  icono: ComponentType<{ className?: string }>
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{titulo}</h2>
      {children}
    </section>
  )
}

export default function Inicio() {
  const { nombre, rol, esAdmin } = useAuth()
  const { data: pedidos, loading: cargandoPedidos } = usePedidos()
  const { data: pedidosCliente, loading: cargandoClientes } = usePedidosCliente()
  const { data: contenedores, loading: cargandoContenedores } = useContenedores()
  const { nombres: nombreProveedor } = useCatalogo('proveedores')

  const porEstado = useMemo(() => {
    const cuenta = new Map<EstadoPedido, number>()
    for (const p of pedidos) cuenta.set(p.estado, (cuenta.get(p.estado) ?? 0) + 1)
    return cuenta
  }, [pedidos])

  const enCurso = pedidos.filter((p) => p.estado !== 'entregado' && p.estado !== 'cancelado')

  /** Fabricados que todavía no tienen contenedor: hay que embarcarlos. */
  const sinEmbarcar = useMemo(
    () => pedidos.filter((p) => p.estado === 'fabricado' && cargaDePedido(p) === 'sin_cargar').slice(0, 5),
    [pedidos],
  )

  const clientesEnCurso = pedidosCliente.filter((p) => p.estado === 'registrado')
  const porPedir = pendientesDeClientes(pedidosCliente).reduce((s, x) => s + x.cantidad, 0)
  const enViaje = contenedores.filter((c) => c.estado !== 'preparando' && c.estado !== 'desembarcado')

  const proximasLlegadas = useMemo(
    () =>
      contenedores
        .filter((c) => c.estado !== 'desembarcado' && c.eta)
        .sort((a, b) => a.eta.localeCompare(b.eta))
        .slice(0, 5),
    [contenedores],
  )

  const hoy = hoyIso()

  const modulos: Modulo[] = [
    { to: '/pedidos', titulo: 'Pedidos a fábrica', descripcion: 'Pedidos a fábrica, estados y documentos.', icono: PackageSearch },
    { to: '/pedidos-cliente', titulo: 'Pedidos de clientes', descripcion: 'Lo que pide cada cliente y de dónde se cubre.', icono: ClipboardList },
    { to: '/contenedores', titulo: 'Contenedores', descripcion: 'Embarques, carga y llegadas.', icono: Container },
    { to: '/productos', titulo: 'Productos', descripcion: 'Catálogo con fotos y precios.', icono: Package },
    { to: '/clientes', titulo: 'Clientes', descripcion: 'Quién pide y todos sus pedidos.', icono: UserRound },
    { to: '/proveedores', titulo: 'Proveedores', descripcion: 'Fábricas y sus pedidos.', icono: Factory },
    { to: '/catalogos', titulo: 'Catálogos', descripcion: 'Marcas, tamaños y tipo de cambio.', icono: Settings2 },
    ...(esAdmin
      ? [{ to: '/usuarios', titulo: 'Usuarios', descripcion: 'Altas, roles y contraseñas.', icono: Users }]
      : []),
  ]

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-foreground">Hola{nombre ? `, ${nombre}` : ''}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rol ? ROL_LABEL[rol] : ''}</p>
      </div>

      <div className="mb-7 grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-5 shadow-xs lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Pedidos en curso</h2>
          {cargandoPedidos ? (
            <Skeleton className="mt-3 h-8 w-64" />
          ) : enCurso.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No hay pedidos en curso.</p>
          ) : (
            <>
              <p className="tabular mt-1 text-3xl font-semibold text-foreground">{enCurso.length}</p>
              <p className="text-xs text-muted-foreground">
                {formatCantidad(enCurso.reduce((s, p) => s + totalesLineas(p.lineas).unidades, 0))} unidades en total
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {ESTADOS_PEDIDO.filter((e) => e !== 'entregado' && e !== 'cancelado' && porEstado.has(e)).map((e) => (
                  <Link key={e} to="/pedidos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <BadgeEstadoPedido estado={e} />
                    <span className="tabular font-medium text-foreground">{porEstado.get(e)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-foreground">Contenedores en viaje</h2>
          {cargandoContenedores ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : (
            <>
              <p className="tabular mt-1 text-3xl font-semibold text-foreground">{enViaje.length}</p>
              <p className="text-xs text-muted-foreground">
                {contenedores.filter((c) => c.estado === 'preparando').length} en preparación
              </p>
            </>
          )}
        </section>
      </div>

      <section className="mb-7 rounded-lg border border-border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-foreground">Pedidos de clientes</h2>
        {cargandoClientes ? (
          <Skeleton className="mt-3 h-8 w-64" />
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-x-10 gap-y-3">
            <Link to="/pedidos-cliente" className="hover:opacity-80">
              <p className="tabular text-3xl font-semibold text-foreground">{clientesEnCurso.length}</p>
              <p className="text-xs text-muted-foreground">en curso</p>
            </Link>
            <Link to="/pedidos-cliente" className="hover:opacity-80">
              <p className={`tabular text-3xl font-semibold ${porPedir > 0 ? 'text-warning' : 'text-foreground'}`}>
                {formatCantidad(porPedir)}
              </p>
              <p className="text-xs text-muted-foreground">unidades por pedir a fábrica</p>
            </Link>
          </div>
        )}
      </section>

      <div className="mb-7 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Próximas llegadas">
          {cargandoContenedores ? (
            <Skeleton className="h-16 w-full" />
          ) : proximasLlegadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay contenedores con fecha de llegada estimada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {proximasLlegadas.map((c) => (
                <li key={c.id}>
                  <Link to={`/contenedores/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:opacity-80">
                    <span className="font-medium text-foreground">{c.numero}</span>
                    <span className={`tabular text-xs ${c.eta < hoy ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                      ETA {formatFecha(c.eta)}
                      {c.eta < hoy && ' · atrasado'}
                    </span>
                    <BadgeEstadoContenedor estado={c.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Fabricados, sin embarcar">
          {cargandoPedidos ? (
            <Skeleton className="h-16 w-full" />
          ) : sinEmbarcar.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos fabricados esperando contenedor.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sinEmbarcar.map((p) => (
                <li key={p.id}>
                  <Link to={`/pedidos/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:opacity-80">
                    <span className="font-medium text-foreground">{p.folio}</span>
                    <span className="text-xs text-muted-foreground">
                      {nombreProveedor.get(p.proveedorId) ?? '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">{ESTADO_PEDIDO_LABEL[p.estado]} {formatFecha(p.fechaEstado)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map(({ to, titulo, descripcion, icono: Icono }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icono className="size-4.5" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

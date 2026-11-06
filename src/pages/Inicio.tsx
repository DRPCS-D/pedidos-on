import { ClipboardList, Container, Factory, PackageSearch, Package, SlidersHorizontal, Users, UserRound } from 'lucide-react'
import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeEstadoContenedor } from '@/components/pedidos/badges'
import { CajaScroll } from '@/components/ui/caja-scroll'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useContenedores } from '@/hooks/useContenedores'
import { usePedidos } from '@/hooks/usePedidos'
import { formatFecha, hoyIso } from '@/lib/format'
import { cargaDePedido } from '@/lib/pedidos'
import { ESTADO_PEDIDO_LABEL, ROL_LABEL } from '@/lib/tipos'

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
  const { data: contenedores, loading: cargandoContenedores } = useContenedores()
  const { nombres: nombreProveedor } = useCatalogo('proveedores')

  /** Fabricados que todavía no tienen contenedor: hay que embarcarlos. Primero los que llevan más tiempo esperando. */
  const sinEmbarcar = useMemo(
    () =>
      pedidos
        .filter((p) => p.estado === 'fabricado' && cargaDePedido(p) === 'sin_cargar')
        .sort((a, b) => a.fechaEstado.localeCompare(b.fechaEstado)),
    [pedidos],
  )

  const proximasLlegadas = useMemo(
    () =>
      contenedores
        .filter((c) => c.estado !== 'desembarcado' && c.eta)
        .sort((a, b) => a.eta.localeCompare(b.eta)),
    [contenedores],
  )

  const hoy = hoyIso()

  const modulos: Modulo[] = [
    { to: '/pedidos', titulo: 'Pedidos a fábrica', descripcion: 'Pedidos a fábrica, estados y documentos.', icono: PackageSearch },
    { to: '/pedidos?pestana=clientes', titulo: 'Pedidos de clientes', descripcion: 'Lo que pide cada cliente y de dónde se cubre.', icono: ClipboardList },
    { to: '/contenedores', titulo: 'Contenedores', descripcion: 'Embarques, carga y llegadas.', icono: Container },
    { to: '/productos', titulo: 'Productos', descripcion: 'Catálogo con fotos, marcas, tamaños y precios.', icono: Package },
    { to: '/clientes', titulo: 'Clientes', descripcion: 'Quién pide y todos sus pedidos.', icono: UserRound },
    { to: '/proveedores', titulo: 'Proveedores', descripcion: 'Fábricas y sus pedidos.', icono: Factory },
    { to: '/configuracion', titulo: 'Configuración', descripcion: 'Plazos, pausas de la fábrica y textos de documentos.', icono: SlidersHorizontal },
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

      <div className="mb-7 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Fabricados, sin embarcar">
          {cargandoPedidos ? (
            <Skeleton className="h-16 w-full" />
          ) : sinEmbarcar.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos fabricados esperando contenedor.</p>
          ) : (
            <CajaScroll alto="max-h-48">
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
            </CajaScroll>
          )}
        </Tarjeta>

        <Tarjeta titulo="Próximas llegadas">
          {cargandoContenedores ? (
            <Skeleton className="h-16 w-full" />
          ) : proximasLlegadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay contenedores con fecha de llegada estimada.</p>
          ) : (
            <CajaScroll alto="max-h-48">
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
            </CajaScroll>
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

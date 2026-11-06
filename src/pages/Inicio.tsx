import { ClipboardList, Container, Factory, Hammer, PackageSearch, Package, Ship, SlidersHorizontal, Users, UserRound } from 'lucide-react'
import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeEstadoContenedor } from '@/components/pedidos/badges'
import { BarraProgreso } from '@/components/ui/barra-progreso'
import { CajaScroll } from '@/components/ui/caja-scroll'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useConfig } from '@/hooks/useConfig'
import { useContenedores } from '@/hooks/useContenedores'
import { usePedidos } from '@/hooks/usePedidos'
import { formatFecha, hoyIso } from '@/lib/format'
import { aDia, fechaDia, proyectar } from '@/lib/proyeccion'
import { ROL_LABEL } from '@/lib/tipos'

interface Modulo {
  to: string
  titulo: string
  descripcion: string
  icono: ComponentType<{ className?: string }>
}

function Tarjeta({ titulo, icono: Icono, children }: { titulo: string; icono: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icono className="size-4 text-primary" />
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export default function Inicio() {
  const { nombre, rol, esAdmin } = useAuth()
  const { data: pedidos, loading: cargandoPedidos } = usePedidos()
  const { data: contenedores, loading: cargandoContenedores } = useContenedores()
  const { nombres: nombreProveedor } = useCatalogo('proveedores')
  const { plazos } = useConfig()

  /** Pedidos en fabricación. Primero los que llevan más tiempo en ese estado. */
  const enFabricacion = useMemo(
    () =>
      pedidos
        .filter((p) => p.estado === 'en_fabricacion')
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

  const dias = (texto: string) => aDia(fechaDia(texto))
  const plural = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

  /**
   * Avance de la fabricación: días de producción transcurridos (sin contar los de pausa) sobre el plazo.
   * Pasado el plazo, la barra queda llena y avisa: posible olvido de cambiar el estado.
   */
  const avanceFabricacion = (desde: string) => {
    const inicio = fechaDia(desde)
    const ini = aDia(inicio)
    const hoyDia = aDia(hoy) ?? 0
    const proy = ini === null ? null : proyectar(inicio, plazos.diasFabricacion, 0, plazos.pausas)
    if (ini === null || !proy) return { pct: 0, transcurridos: 0, total: plazos.diasFabricacion, vencio: false, enPausa: false, vence: '' }
    const fin = aDia(proy.finFabricacion) ?? ini
    let transcurridos = 0
    if (hoyDia > fin) transcurridos = plazos.diasFabricacion + (hoyDia - fin)
    else for (let d = ini + 1; d <= hoyDia; d++) if (proy.dias.get(d) === 'fabricacion') transcurridos++
    return {
      pct: (transcurridos / plazos.diasFabricacion) * 100,
      transcurridos,
      total: plazos.diasFabricacion,
      vencio: hoyDia > fin,
      enPausa: proy.dias.get(hoyDia) === 'pausa',
      vence: proy.finFabricacion,
    }
  }

  /** Avance del viaje: de la salida (ETD) a la llegada estimada (ETA). Sin ETD no se puede medir y la barra queda vacía. */
  const avanceViaje = (etd: string, eta: string) => {
    const a = dias(etd)
    const b = dias(eta) ?? 0
    const hoyDia = aDia(hoy) ?? 0
    const faltan = b - hoyDia
    const pct = a !== null && b > a ? ((hoyDia - a) / (b - a)) * 100 : 0
    return { pct, faltan }
  }

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
        <Tarjeta titulo="En fabricación" icono={Hammer}>
          {cargandoPedidos ? (
            <Skeleton className="h-16 w-full" />
          ) : enFabricacion.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos en fabricación.</p>
          ) : (
            <CajaScroll alto="max-h-84">
              <ul className="divide-y divide-border">
                {enFabricacion.map((p) => {
                  const t = avanceFabricacion(p.fechaEstado)
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/pedidos/${p.id}`}
                        className="block space-y-1.5 py-2.5 text-sm hover:opacity-80"
                        title={`En fabricación desde el ${formatFecha(p.fechaEstado)}${t.vence ? ` · plazo hasta el ${formatFecha(t.vence)}` : ''}`}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-foreground">{p.folio}</span>
                          <span className="truncate text-xs text-muted-foreground">{nombreProveedor.get(p.proveedorId) ?? '—'}</span>
                        </span>
                        <BarraProgreso pct={t.pct} tono={t.vencio ? 'aviso' : 'normal'} />
                        <span className={`tabular block text-xs ${t.vencio ? 'font-medium text-warning' : 'text-muted-foreground'}`}>
                          {t.transcurridos} de {plural(t.total)}
                          {t.enPausa && ' · en pausa'}
                          {t.vencio && ' · ¿ya está fabricado?'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CajaScroll>
          )}
        </Tarjeta>

        <Tarjeta titulo="Próximas llegadas" icono={Ship}>
          {cargandoContenedores ? (
            <Skeleton className="h-16 w-full" />
          ) : proximasLlegadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay contenedores con fecha de llegada estimada.</p>
          ) : (
            <CajaScroll alto="max-h-84">
              <ul className="divide-y divide-border">
                {proximasLlegadas.map((c) => {
                  const v = avanceViaje(c.etd, c.eta)
                  const atrasado = v.faltan < 0
                  return (
                    <li key={c.id}>
                      <Link to={`/contenedores/${c.id}`} className="block space-y-1.5 py-2.5 text-sm hover:opacity-80">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">{c.numero}</span>
                          <BadgeEstadoContenedor estado={c.estado} />
                        </span>
                        <BarraProgreso pct={atrasado ? 100 : v.pct} tono={atrasado ? 'atrasado' : 'normal'} />
                        <span className={`tabular block text-xs ${atrasado ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                          {atrasado ? `Atrasado ${plural(-v.faltan)}` : v.faltan === 0 ? 'Llega hoy' : `Faltan ${plural(v.faltan)}`}
                          {' · ETA '}
                          {formatFecha(c.eta)}
                          {!dias(c.etd) && ' · sin fecha de salida'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
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

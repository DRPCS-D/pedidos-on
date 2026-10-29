import { ChevronDown, KeyRound, LogOut, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CambiarMiPasswordModal } from '@/components/cuenta/CambiarMiPasswordModal'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/hooks/useAuth'
import { useForzarActualizacion } from '@/hooks/useTabla'
import { ROL_LABEL } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const NAV_PRINCIPAL = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/pedidos', label: 'Pedidos fábrica', end: false },
  { to: '/pedidos-cliente', label: 'Pedidos cliente', end: false },
  { to: '/contenedores', label: 'Contenedores', end: false },
]
const NAV_MAS = [
  { to: '/productos', label: 'Productos' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/catalogos', label: 'Catálogos' },
]
const NAV_USUARIOS = { to: '/usuarios', label: 'Usuarios' }

/** Menú desplegable con las secciones que se usan menos. */
function MenuMas({ items }: { items: { to: string; label: string }[] }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const activo = items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  return (
    <div ref={raiz} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
          activo || abierto
            ? 'bg-accent font-medium text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        Más <ChevronDown className={cn('size-3.5 transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-md border border-border bg-card p-1 shadow-lg sm:left-0 sm:right-auto"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className={({ isActive }) =>
                cn(
                  'block rounded-sm px-3 py-2 text-sm',
                  isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground hover:bg-accent',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

const claseLink = (isActive: boolean) =>
  cn(
    'shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors',
    isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  )

export default function AppLayout() {
  const { usuario, nombre, rol, esAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [modalPassword, setModalPassword] = useState(false)
  const { forzando, forzar } = useForzarActualizacion()

  const MAS = esAdmin ? [...NAV_MAS, NAV_USUARIOS] : NAV_MAS

  useEffect(() => {
    if (!usuario) navigate('/login', { replace: true })
  }, [usuario, navigate])

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <span className="flex min-w-0 items-center gap-2">
            <img src="/logo-on.png" alt="" className="h-7 w-auto shrink-0" />
            <span className="truncate text-sm font-semibold text-foreground">Pedidos ON</span>
          </span>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {NAV_PRINCIPAL.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => claseLink(isActive)}>
                {item.label}
              </NavLink>
            ))}
            <MenuMas items={MAS} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-foreground">{nombre}</p>
              <p className="text-[11px] text-muted-foreground">{rol ? ROL_LABEL[rol] : ''}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={forzando}
              title="Actualizar datos"
              aria-label="Actualizar datos"
              onClick={async () => {
                const ok = await forzar()
                if (ok) toast.success('Datos actualizados.')
                else toast.error('No se pudo actualizar todo. Revisa tu conexión.')
              }}
            >
              <RefreshCw className={cn(forzando && 'animate-spin')} />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setModalPassword(true)} title="Cambiar mi contraseña">
              <KeyRound />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
              <LogOut />
            </Button>
          </div>
        </div>

        {/* Navegacion en mobile: la fila de arriba se queda sin lugar */}
        <nav className="flex items-center gap-1 border-t border-border px-4 py-1.5 sm:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {NAV_PRINCIPAL.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => claseLink(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <MenuMas items={MAS} />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <CambiarMiPasswordModal abierto={modalPassword} onCerrar={() => setModalPassword(false)} />
    </div>
  )
}

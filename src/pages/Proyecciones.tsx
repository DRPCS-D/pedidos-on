import { CalendarDays, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProyeccionFormModal } from '@/components/proyeccion/ProyeccionFormModal'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { formatFecha, normalizar } from '@/lib/format'

/** Lista de proyecciones de entrega guardadas; al entrar a una se ve su detalle con el calendario. */
export default function Proyecciones() {
  const { puedeEditar } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useCatalogo('proyecciones')
  const [nueva, setNueva] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Las más recientes primero: por fecha de llegada, de la más lejana a la más próxima.
  const ordenadas = useMemo(() => [...data].sort((a, b) => b.llegada.localeCompare(a.llegada)), [data])
  const filas = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return ordenadas
    return ordenadas.filter((g) =>
      normalizar(`${g.nombre} ${g.notas} ${formatFecha(g.inicio)} ${formatFecha(g.finFabricacion)} ${formatFecha(g.llegada)}`).includes(q),
    )
  }, [ordenadas, busqueda])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {ordenadas.length > 0 && (
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar"
              className="pl-9"
              placeholder="Nombre, notas o fecha…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        )}
        {puedeEditar && (
          <Button className="ml-auto" onClick={() => setNueva(true)}>
            <Plus /> Nueva proyección
          </Button>
        )}
      </div>

      {error ? (
        <ErrorBox mensaje={error} />
      ) : loading && data.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : ordenadas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <Vacio
            icono={CalendarDays}
            titulo="Todavía no hay proyecciones"
            descripcion="Crea una con la fecha de inicio de la fabricación o con la fecha en que el cliente quiere recibir."
          />
        </div>
      ) : filas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <Vacio icono={CalendarDays} titulo="Sin resultados" descripcion="Prueba con otra búsqueda." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Calculada desde</th>
                <th className="px-4 py-2.5 font-medium">Inicio de fabricación</th>
                <th className="px-4 py-2.5 font-medium">Fin de fabricación</th>
                <th className="px-4 py-2.5 font-medium">Llegada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((g) => (
                <tr key={g.id} onClick={() => navigate(`/proyeccion/${g.id}`)} className="cursor-pointer transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link to={`/proyeccion/${g.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {g.nombre}
                    </Link>
                    {g.notas && <p className="text-xs font-normal text-muted-foreground">{g.notas}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {g.modo === 'final' ? `Fecha final (${formatFecha(g.fechaBase)})` : 'Fecha de inicio'}
                  </td>
                  <td className="tabular px-4 py-3 text-muted-foreground">{formatFecha(g.inicio)}</td>
                  <td className="tabular px-4 py-3 text-muted-foreground">{formatFecha(g.finFabricacion)}</td>
                  <td className="tabular px-4 py-3 font-medium text-foreground">{formatFecha(g.llegada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProyeccionFormModal
        proyeccion={nueva ? 'nueva' : null}
        onCerrar={() => setNueva(false)}
        onGuardada={(id) => {
          setNueva(false)
          refetch()
          navigate(`/proyeccion/${id}`)
        }}
      />
    </div>
  )
}

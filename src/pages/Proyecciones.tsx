import { CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProyeccionFormModal } from '@/components/proyeccion/ProyeccionFormModal'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { formatFecha } from '@/lib/format'

/** Lista de proyecciones de entrega guardadas; al entrar a una se ve su detalle con el calendario. */
export default function Proyecciones() {
  const { puedeEditar } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useCatalogo('proyecciones')
  const [nueva, setNueva] = useState(false)

  // Las más recientes primero: por fecha de llegada, de la más lejana a la más próxima.
  const filas = [...data].sort((a, b) => b.llegada.localeCompare(a.llegada))

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Proyección de entrega</h1>
          <p className="text-sm text-muted-foreground">
            Cuándo llegaría un pedido y hasta cuándo se puede hacer, descontando las pausas de la fábrica.
          </p>
        </div>
        {puedeEditar && (
          <Button onClick={() => setNueva(true)}>
            <Plus /> Nueva proyección
          </Button>
        )}
      </div>

      {error ? (
        <ErrorBox mensaje={error} />
      ) : loading && data.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : filas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <Vacio
            icono={CalendarDays}
            titulo="Todavía no hay proyecciones"
            descripcion="Crea una con la fecha de inicio de la fabricación o con la fecha en que el cliente quiere recibir."
          />
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

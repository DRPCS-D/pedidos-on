import { useHistorial } from '@/hooks/useHistorial'
import { formatFecha } from '@/lib/format'

/** Cambios de estado con su fecha, quién los registró y la nota. */
export function LineaDeTiempo({
  entidad,
  id,
  etiquetas,
}: {
  entidad: 'pedido' | 'contenedor'
  id: string
  etiquetas: Record<string, string>
}) {
  const { data, loading, error } = useHistorial(entidad, id)

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (loading) return <p className="text-xs text-muted-foreground">Cargando historial…</p>
  if (data.length === 0) return <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {data.map((h, i) => (
        <li key={h.id} className="relative">
          <span
            className={`absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-card ${
              i === data.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'
            }`}
          />
          <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-medium text-foreground">{etiquetas[h.estado] ?? h.estado}</span>
            <span className="tabular text-xs text-muted-foreground">{formatFecha(h.fecha)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {h.usuarioNombre || h.usuario}
            {h.nota && ` · ${h.nota}`}
          </p>
        </li>
      ))}
    </ol>
  )
}

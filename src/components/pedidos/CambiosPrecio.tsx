import { useCambiosPrecio } from '@/hooks/useCambiosPrecio'
import { formatGs, formatUsd } from '@/lib/format'
import type { CambioPrecio } from '@/lib/tipos'

const CAMPO: Record<CambioPrecio['campo'], string> = {
  precioCosto: 'Costo',
  precioVentaUsd: 'Venta USD',
  precioVentaGs: 'Venta Gs',
}

const monto = (c: CambioPrecio, n: number) => (c.campo === 'precioVentaGs' ? formatGs(n) : formatUsd(n))

const cuando = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
}

/** Modificaciones de precio hechas después de cargar el pedido, con el precio anterior. No aparece si no hubo ninguna. */
export function CambiosPrecio({ entidad, id }: { entidad: 'pedido' | 'pedidoCliente'; id: string }) {
  const { data } = useCambiosPrecio(entidad, id)
  if (data.length === 0) return null

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">Cambios de precio</h2>
      <p className="px-5 pt-3 text-xs text-muted-foreground">
        Este pedido conserva los precios con que se cargó. Aquí quedan las veces que se modificaron, con el precio original.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Cuándo</th>
              <th className="px-4 py-2.5 font-medium">Producto</th>
              <th className="px-4 py-2.5 font-medium">Precio</th>
              <th className="px-4 py-2.5 text-right font-medium">Antes</th>
              <th className="px-4 py-2.5 text-right font-medium">Ahora</th>
              <th className="px-4 py-2.5 font-medium">Quién</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted-foreground">{cuando(c.cuando)}</td>
                <td className="px-4 py-2.5 text-foreground">
                  <span className="font-medium">{c.codigo}</span> <span className="text-muted-foreground">{c.descripcion}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{CAMPO[c.campo]}</td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">{monto(c, c.anterior)}</td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right font-medium text-foreground">{monto(c, c.nuevo)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.usuarioNombre || c.usuario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

import { Link } from 'react-router-dom'
import { BadgeEstadoPedido } from '@/components/pedidos/badges'
import { usePedidos } from '@/hooks/usePedidos'
import { formatFecha } from '@/lib/format'

/** Pedidos a fábrica de un proveedor, para su ficha. */
export function PedidosDe({ id }: { id: string }) {
  const { data } = usePedidos()
  // Los más nuevos arriba.
  const lista = data.filter((p) => p.proveedorId === id).sort((a, b) => b.fechaPedido.localeCompare(a.fechaPedido) || b.folio.localeCompare(a.folio))

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 shrink-0 text-sm font-semibold text-foreground">Pedidos ({lista.length})</h3>
      {lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Todavía no tiene pedidos.</p>
      ) : (
        <ul className="max-h-96 min-h-0 divide-y divide-border overflow-y-auto md:max-h-none rounded-md border border-border">
          {lista.map((p) => (
            <li key={p.id}>
              <Link
                to={`/pedidos/${p.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-accent/40"
              >
                <span className="font-medium text-foreground">{p.folio}</span>
                <span className="text-xs text-muted-foreground">{formatFecha(p.fechaPedido)}</span>
                <BadgeEstadoPedido estado={p.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

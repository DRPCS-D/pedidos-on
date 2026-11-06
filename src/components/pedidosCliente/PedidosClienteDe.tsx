import { Link } from 'react-router-dom'
import { BadgeSituacion } from '@/components/pedidosCliente/badges'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { formatFecha } from '@/lib/format'

/** Pedidos de un cliente, para su ficha. */
export function PedidosClienteDe({ clienteId }: { clienteId: string }) {
  const { data } = usePedidosCliente()
  const { porId: pedidos } = usePedidos()
  // Los más nuevos arriba.
  const lista = data.filter((p) => p.clienteId === clienteId).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.folio.localeCompare(a.folio))

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
                to={`/pedidos-cliente/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-accent/40"
              >
                <span className="font-medium text-foreground">{p.folio}</span>
                <span className="text-xs text-muted-foreground">{formatFecha(p.fecha)}</span>
                <BadgeSituacion pedido={p} pedidos={pedidos} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

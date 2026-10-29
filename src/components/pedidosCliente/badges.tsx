import { BadgeEstadoPedido } from '@/components/pedidos/badges'
import { Badge, type TonoBadge } from '@/components/ui/badge'
import { COBERTURA_LABEL, situacionDe } from '@/lib/pedidoCliente'
import { ESTADO_PC_LABEL, type EstadoPedidoCliente, type Pedido, type PedidoCliente } from '@/lib/tipos'

const TONO_PC: Record<EstadoPedidoCliente, TonoBadge> = {
  registrado: 'neutral',
  entregado: 'success',
  cancelado: 'danger',
}

export function BadgeEstadoPC({ estado }: { estado: EstadoPedidoCliente }) {
  return <Badge tono={TONO_PC[estado]}>{ESTADO_PC_LABEL[estado]}</Badge>
}

/**
 * Dónde está lo del cliente: si falta pedirlo a la fábrica, o el estado del pedido a
 * fábrica menos avanzado que lo abastece (con «cubierto en parte» si falta algo).
 */
export function BadgeSituacion({
  pedido,
  pedidos,
}: {
  pedido: Pick<PedidoCliente, 'lineas' | 'estado'>
  pedidos: Map<string, Pick<Pedido, 'estado'>>
}) {
  if (pedido.estado !== 'registrado') return <BadgeEstadoPC estado={pedido.estado} />
  const s = situacionDe(pedido, pedidos)
  if (s.cobertura === 'sin_asignar' || !s.estado) return <Badge tono="warning">{COBERTURA_LABEL.sin_asignar}</Badge>
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Fábrica:</span>
      <BadgeEstadoPedido estado={s.estado} />
      {s.cobertura === 'parcial' && <Badge tono="warning">{COBERTURA_LABEL.parcial}</Badge>}
    </span>
  )
}

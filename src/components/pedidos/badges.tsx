import { Badge, type TonoBadge } from '@/components/ui/badge'
import { CARGA_LABEL, type CargaPedido } from '@/lib/pedidos'
import {
  ESTADO_CONTENEDOR_LABEL,
  ESTADO_PEDIDO_LABEL,
  type EstadoContenedor,
  type EstadoPedido,
} from '@/lib/tipos'

const TONO_PEDIDO: Record<EstadoPedido, TonoBadge> = {
  registrado: 'neutral',
  confirmado: 'neutral',
  en_fabricacion: 'warning',
  fabricado: 'warning',
  embarcado: 'primary',
  en_transito: 'primary',
  en_puerto: 'primary',
  desembarcado: 'success',
  entregado: 'success',
  cancelado: 'danger',
}

const TONO_CONTENEDOR: Record<EstadoContenedor, TonoBadge> = {
  preparando: 'neutral',
  embarcado: 'primary',
  en_transito: 'primary',
  en_puerto: 'warning',
  desembarcado: 'success',
}

export function BadgeEstadoPedido({ estado }: { estado: EstadoPedido }) {
  return <Badge tono={TONO_PEDIDO[estado]}>{ESTADO_PEDIDO_LABEL[estado]}</Badge>
}

export function BadgeEstadoContenedor({ estado }: { estado: EstadoContenedor }) {
  return <Badge tono={TONO_CONTENEDOR[estado]}>{ESTADO_CONTENEDOR_LABEL[estado]}</Badge>
}

/** Solo se muestra cuando hay algo que decir (parcial); «sin cargar» y «completa» van en texto aparte. */
export function BadgeCarga({ carga }: { carga: CargaPedido }) {
  const tono: TonoBadge = carga === 'completa' ? 'success' : carga === 'parcial' ? 'warning' : 'neutral'
  return <Badge tono={tono}>{CARGA_LABEL[carga]}</Badge>
}

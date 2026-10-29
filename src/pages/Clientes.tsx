import { useMemo } from 'react'
import { CatalogoSimple, type CampoCatalogo, type ColumnaCatalogo } from '@/components/catalogos/CatalogoSimple'
import { PedidosClienteDe } from '@/components/pedidosCliente/PedidosClienteDe'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'

const CAMPOS: CampoCatalogo[] = [
  { clave: 'nombre', label: 'Nombre / razón social', max: 80, requerido: true },
  { clave: 'ruc', label: 'RUC / documento', max: 30 },
  { clave: 'telefono', label: 'Teléfono', max: 40 },
  { clave: 'email', label: 'Email', max: 80 },
  { clave: 'direccion', label: 'Dirección', max: 150 },
  { clave: 'notas', label: 'Notas', max: 1000, multilinea: true },
]

export default function Clientes() {
  const { data: pedidos } = usePedidosCliente()
  const cuenta = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pedidos) m.set(p.clienteId, (m.get(p.clienteId) ?? 0) + 1)
    return m
  }, [pedidos])

  const columnas: ColumnaCatalogo[] = [
    { label: 'Nombre', render: (r) => r.nombre },
    { label: 'RUC', render: (r) => r.ruc || '—' },
    { label: 'Teléfono', render: (r) => r.telefono || '—' },
    { label: 'Dirección', render: (r) => r.direccion || '—' },
    { label: 'Pedidos', render: (r) => cuenta.get(r.id) ?? 0 },
  ]

  return (
    <CatalogoSimple
      tabla="clientes"
      titulo="Clientes"
      descripcion="Quién pide. Sus pedidos se cubren con lo que llega de una o varias fábricas."
      singular="cliente"
      campos={CAMPOS}
      columnas={columnas}
      extra={(r) => <PedidosClienteDe clienteId={r.id} />}
    />
  )
}

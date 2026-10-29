import { useMemo } from 'react'
import { CatalogoSimple, type CampoCatalogo, type ColumnaCatalogo } from '@/components/catalogos/CatalogoSimple'
import { PedidosDe } from '@/components/pedidos/PedidosDe'
import { usePedidos } from '@/hooks/usePedidos'

const CAMPOS: CampoCatalogo[] = [
  { clave: 'nombre', label: 'Nombre de la fábrica', max: 80, requerido: true },
  { clave: 'contacto', label: 'Persona de contacto', max: 80 },
  { clave: 'telefono', label: 'Teléfono / WeChat', max: 40 },
  { clave: 'email', label: 'Email', max: 80 },
  { clave: 'ciudad', label: 'Ciudad', max: 60 },
  { clave: 'notas', label: 'Notas', max: 1000, multilinea: true },
]

export default function Proveedores() {
  const { data: pedidos } = usePedidos()
  const cuenta = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pedidos) m.set(p.proveedorId, (m.get(p.proveedorId) ?? 0) + 1)
    return m
  }, [pedidos])

  const columnas: ColumnaCatalogo[] = [
    { label: 'Nombre', render: (r) => r.nombre },
    { label: 'Contacto', render: (r) => r.contacto || '—' },
    { label: 'Teléfono', render: (r) => r.telefono || '—' },
    { label: 'Ciudad', render: (r) => r.ciudad || '—' },
    { label: 'Pedidos', render: (r) => cuenta.get(r.id) ?? 0 },
  ]

  return (
    <CatalogoSimple
      tabla="proveedores"
      titulo="Proveedores"
      descripcion="Fábricas a las que se hacen los pedidos."
      singular="proveedor"
      campos={CAMPOS}
      columnas={columnas}
      extra={(r) => <PedidosDe id={r.id} />}
    />
  )
}

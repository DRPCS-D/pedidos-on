import { PackageSearch, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCarga, BadgeEstadoPedido } from '@/components/pedidos/badges'
import { PedidoFormModal } from '@/components/pedidos/PedidoFormModal'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Input, Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { usePedidos } from '@/hooks/usePedidos'
import { formatFecha, formatUsd, normalizar } from '@/lib/format'
import { cargaDePedido, totalesLineas } from '@/lib/pedidos'
import { ESTADO_PEDIDO_LABEL, ESTADOS_PEDIDO, type EstadoPedido } from '@/lib/tipos'

type FiltroEstado = EstadoPedido | 'activos' | ''

export default function Pedidos() {
  const { puedeEditar } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error } = usePedidos()
  const { data: proveedores, nombres: nombreProveedor } = useCatalogo('proveedores')
  const { data: clientes, nombres: nombreCliente } = useCatalogo('clientes')

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('activos')
  const [proveedorId, setProveedorId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [nuevo, setNuevo] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return data.filter((p) => {
      if (estado === 'activos' ? p.estado === 'entregado' || p.estado === 'cancelado' : estado && p.estado !== estado) return false
      if (proveedorId && p.proveedorId !== proveedorId) return false
      if (clienteId && p.clienteId !== clienteId) return false
      if (!q) return true
      const texto = `${p.folio} ${nombreProveedor.get(p.proveedorId) ?? ''} ${nombreCliente.get(p.clienteId) ?? ''} ${p.lineas.map((l) => l.codigo).join(' ')}`
      return normalizar(texto).includes(q)
    })
  }, [data, busqueda, estado, proveedorId, clienteId, nombreProveedor, nombreCliente])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Pedidos a fábricas de China y su estado.</p>
        </div>
        {puedeEditar && (
          <Button onClick={() => setNuevo(true)}>
            <Plus /> Nuevo pedido
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="mb-4 h-9.5 max-w-xl" />
      ) : (
        data.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar"
                className="pl-9"
                placeholder="Folio, fábrica, cliente o código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Select aria-label="Estado" className="w-44" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}>
              <option value="activos">En curso</option>
              <option value="">Todos los estados</option>
              {ESTADOS_PEDIDO.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_PEDIDO_LABEL[e]}
                </option>
              ))}
            </Select>
            <Select aria-label="Fábrica" className="w-44" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Todas las fábricas</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
            <Select aria-label="Cliente" className="w-44" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
        )
      )}

      {loading ? (
        <TableSkeleton columnas={[10, 12, 20, 20, 8, 12, 14]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio
          icono={PackageSearch}
          titulo="Sin pedidos todavía"
          descripcion={puedeEditar ? 'Crea el primero con «Nuevo pedido». Necesitas al menos una fábrica y un producto.' : undefined}
        />
      ) : filtrados.length === 0 ? (
        <Vacio icono={PackageSearch} titulo="Sin resultados" descripcion="Prueba con otro filtro." />
      ) : (
        <TablaScroll total={filtrados.length} clave={`${busqueda}|${estado}|${proveedorId}|${clienteId}`}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Folio</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Fábrica</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unid.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Costo</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, limite).map((p) => {
                  const t = totalesLineas(p.lineas)
                  const carga = cargaDePedido(p)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/pedidos/${p.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/pedidos/${p.id}`)
                        }
                      }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{p.folio}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatFecha(p.fechaPedido)}</td>
                      <td className="px-4 py-2.5 text-foreground">{nombreProveedor.get(p.proveedorId) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{nombreCliente.get(p.clienteId) ?? 'Stock'}</td>
                      <td className="tabular px-4 py-2.5 text-right text-foreground">{t.unidades.toLocaleString('es-PY')}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">{formatUsd(t.costo)}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <BadgeEstadoPedido estado={p.estado} />
                          {carga === 'parcial' && <BadgeCarga carga={carga} />}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatFecha(p.fechaEstado)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <PedidoFormModal
        abierto={nuevo}
        pedido={null}
        onCerrar={() => setNuevo(false)}
        onGuardado={(id) => {
          setNuevo(false)
          navigate(`/pedidos/${id}`)
        }}
      />
    </div>
  )
}

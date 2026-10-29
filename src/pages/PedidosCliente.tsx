import { Plus, Search, Users, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BadgeSituacion } from '@/components/pedidosCliente/badges'
import { PedidoClienteFormModal } from '@/components/pedidosCliente/PedidoClienteFormModal'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Input, Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { formatCantidad, formatFecha, formatUsd, normalizar } from '@/lib/format'
import { totalesLineas } from '@/lib/pedidos'
import { pendientesDeClientes } from '@/lib/pedidoCliente'

type FiltroEstado = 'activos' | 'todos' | 'registrado' | 'entregado' | 'cancelado'

export default function PedidosCliente() {
  const { puedeEditar } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch, asignarAutomatico } = usePedidosCliente()
  const { porId: pedidos, refetch: refetchPedidos } = usePedidos()
  const { data: clientes, nombres: nombreCliente } = useCatalogo('clientes')

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('activos')
  const [clienteId, setClienteId] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const [asignando, setAsignando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return data.filter((p) => {
      if (estado === 'activos' ? p.estado !== 'registrado' : estado !== 'todos' && p.estado !== estado) return false
      if (clienteId && p.clienteId !== clienteId) return false
      if (!q) return true
      return normalizar(`${p.folio} ${nombreCliente.get(p.clienteId) ?? ''} ${p.lineas.map((l) => l.codigo).join(' ')}`).includes(q)
    })
  }, [data, busqueda, estado, clienteId, nombreCliente])

  const unidadesPendientes = pendientesDeClientes(data).reduce((s, x) => s + x.cantidad, 0)

  async function asignarTodo() {
    setAsignando(true)
    const { error: err, data: r } = await asignarAutomatico()
    setAsignando(false)
    if (err) return toast.error(err)
    toast.success(r?.asignado ? `${formatCantidad(r.asignado)} unidades asignadas.` : 'No había nada disponible para asignar.')
    refetch()
    refetchPedidos()
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pedidos de clientes</h1>
          <p className="text-sm text-muted-foreground">
            Lo que pide cada cliente y de qué pedidos a fábrica se cubre.
            {unidadesPendientes > 0 && ` Faltan por pedir a fábrica ${formatCantidad(unidadesPendientes)} unidades.`}
          </p>
        </div>
        {puedeEditar && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={asignarTodo} disabled={asignando} title="Cubre los pedidos con lo que haya disponible en pedidos a fábrica">
              <Wand2 /> {asignando ? 'Asignando…' : 'Asignar lo disponible'}
            </Button>
            <Button onClick={() => setNuevo(true)}>
              <Plus /> Nuevo pedido de cliente
            </Button>
          </div>
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
                placeholder="Folio, cliente o código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Select aria-label="Estado" className="w-44" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}>
              <option value="activos">En curso</option>
              <option value="todos">Todos</option>
              <option value="entregado">Entregados</option>
              <option value="cancelado">Cancelados</option>
            </Select>
            <Select aria-label="Cliente" className="w-48" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
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
        <TableSkeleton columnas={[10, 12, 22, 8, 12, 12, 20]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio
          icono={Users}
          titulo="Sin pedidos de clientes todavía"
          descripcion={puedeEditar ? 'Crea el primero con «Nuevo pedido de cliente». Necesitas al menos un cliente y un producto.' : undefined}
        />
      ) : filtrados.length === 0 ? (
        <Vacio icono={Users} titulo="Sin resultados" descripcion="Prueba con otro filtro." />
      ) : (
        <TablaScroll total={filtrados.length} clave={`${busqueda}|${estado}|${clienteId}`}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Folio</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unid.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cubierto</th>
                  <th className="px-4 py-2.5 text-right font-medium">Venta</th>
                  <th className="px-4 py-2.5 font-medium">Situación</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, limite).map((p) => {
                  const t = totalesLineas(p.lineas)
                  const cubierto = p.lineas.reduce((s, l) => s + Math.min(l.asignado, l.cantidad), 0)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/pedidos-cliente/${p.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/pedidos-cliente/${p.id}`)
                        }
                      }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{p.folio}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatFecha(p.fecha)}</td>
                      <td className="px-4 py-2.5 text-foreground">{nombreCliente.get(p.clienteId) ?? '—'}</td>
                      <td className="tabular px-4 py-2.5 text-right text-foreground">{formatCantidad(t.unidades)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">
                        {formatCantidad(cubierto)} / {formatCantidad(t.unidades)}
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">{formatUsd(t.ventaUsd)}</td>
                      <td className="px-4 py-2.5">
                        <BadgeSituacion pedido={p} pedidos={pedidos} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <PedidoClienteFormModal
        abierto={nuevo}
        pedido={null}
        onCerrar={() => setNuevo(false)}
        onGuardado={(id) => {
          setNuevo(false)
          refetchPedidos()
          navigate(`/pedidos-cliente/${id}`)
        }}
      />
    </div>
  )
}

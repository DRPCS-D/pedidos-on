import { Container, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContenedorFormModal } from '@/components/contenedores/ContenedorFormModal'
import { BadgeEstadoContenedor } from '@/components/pedidos/badges'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Input, Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { useAuth } from '@/hooks/useAuth'
import { useContenedores } from '@/hooks/useContenedores'
import { formatCantidad, formatFecha, normalizar } from '@/lib/format'
import {
  ESTADO_CONTENEDOR_LABEL,
  ESTADOS_CONTENEDOR,
  TIPO_CONTENEDOR_LABEL,
  type EstadoContenedor,
} from '@/lib/tipos'

type FiltroEstado = EstadoContenedor | 'activos' | ''

export default function Contenedores() {
  const { puedeEditar } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error } = useContenedores()

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('activos')
  const [nuevo, setNuevo] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return data.filter((c) => {
      if (estado === 'activos' ? c.estado === 'desembarcado' : estado && c.estado !== estado) return false
      if (!q) return true
      return normalizar(`${c.numero} ${c.naviera} ${c.bl} ${c.puertoDestino}`).includes(q)
    })
  }, [data, busqueda, estado])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Contenedores</h1>
          <p className="text-sm text-muted-foreground">Embarques: qué lleva cada contenedor y dónde está.</p>
        </div>
        {puedeEditar && (
          <Button onClick={() => setNuevo(true)}>
            <Plus /> Nuevo contenedor
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="mb-4 h-9.5 max-w-md" />
      ) : (
        data.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar"
                className="pl-9"
                placeholder="Número, naviera, BL o destino…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Select aria-label="Estado" className="w-48" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}>
              <option value="activos">En curso</option>
              <option value="">Todos los estados</option>
              {ESTADOS_CONTENEDOR.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_CONTENEDOR_LABEL[e]}
                </option>
              ))}
            </Select>
          </div>
        )
      )}

      {loading ? (
        <TableSkeleton columnas={[16, 8, 16, 18, 10, 10, 8, 14]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio
          icono={Container}
          titulo="Sin contenedores todavía"
          descripcion={puedeEditar ? 'Crea uno con «Nuevo contenedor» y asígnale la carga de tus pedidos.' : undefined}
        />
      ) : filtrados.length === 0 ? (
        <Vacio icono={Container} titulo="Sin resultados" descripcion="Prueba con otro filtro." />
      ) : (
        <TablaScroll total={filtrados.length} clave={`${busqueda}|${estado}`}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Número</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Naviera</th>
                  <th className="px-4 py-2.5 font-medium">Ruta</th>
                  <th className="px-4 py-2.5 font-medium">ETD</th>
                  <th className="px-4 py-2.5 font-medium">ETA</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pedidos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unid.</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, limite).map((c) => {
                  const pedidos = new Set(c.cargas.map((x) => x.pedidoId)).size
                  const unidades = c.cargas.reduce((s, x) => s + x.cantidad, 0)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/contenedores/${c.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/contenedores/${c.id}`)
                        }
                      }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">{c.numero}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{TIPO_CONTENEDOR_LABEL[c.tipo]}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.naviera || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {c.puertoOrigen || c.puertoDestino ? `${c.puertoOrigen || '?'} → ${c.puertoDestino || '?'}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatFecha(c.etd)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-foreground">{formatFecha(c.eta)}</td>
                      <td className="tabular px-4 py-2.5 text-right text-foreground">{pedidos}</td>
                      <td className="tabular px-4 py-2.5 text-right text-foreground">{formatCantidad(unidades)}</td>
                      <td className="px-4 py-2.5">
                        <BadgeEstadoContenedor estado={c.estado} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <ContenedorFormModal
        abierto={nuevo}
        contenedor={null}
        onCerrar={() => setNuevo(false)}
        onGuardado={(id) => {
          setNuevo(false)
          navigate(`/contenedores/${id}`)
        }}
      />
    </div>
  )
}

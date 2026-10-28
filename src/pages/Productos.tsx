import { ImageOff, Package, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ProductoFormModal } from '@/components/productos/ProductoFormModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Input, Select } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { urlMiniatura } from '@/hooks/useArchivos'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useProductos } from '@/hooks/useProductos'
import { formatGs, formatUsd, normalizar } from '@/lib/format'
import type { Producto } from '@/lib/tipos'

/** '38 · 39 · 40' para pocos; '36 … 44 (9)' si son muchos. */
function resumenTamanos(ids: string[], nombres: Map<string, string>): string {
  const lista = ids.map((id) => nombres.get(id) ?? '?')
  if (lista.length === 0) return '—'
  return lista.length <= 6 ? lista.join(' · ') : `${lista[0]} … ${lista[lista.length - 1]} (${lista.length})`
}

export default function Productos() {
  const { puedeEditar } = useAuth()
  const { data, loading, error, refetch, borrar } = useProductos()
  const { data: marcas, nombres: nombreMarca } = useCatalogo('marcas')
  const { nombres: nombreTamano } = useCatalogo('tamanos')
  const { data: proveedores } = useCatalogo('proveedores')

  const [busqueda, setBusqueda] = useState('')
  const [marcaId, setMarcaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [modal, setModal] = useState<'nuevo' | Producto | null>(null)
  const [aBorrar, setABorrar] = useState<Producto | null>(null)
  const [borrando, setBorrando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return data.filter((p) => {
      if (!verInactivos && !p.activo) return false
      if (marcaId && p.marcaId !== marcaId) return false
      if (proveedorId && p.proveedorId !== proveedorId) return false
      if (!q) return true
      return normalizar(`${p.codigo} ${p.descripcion} ${p.colores.join(' ')}`).includes(q)
    })
  }, [data, busqueda, marcaId, proveedorId, verInactivos])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground">Catálogo con precios de costo y de venta.</p>
        </div>
        {puedeEditar && (
          <Button onClick={() => setModal('nuevo')}>
            <Plus /> Nuevo
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
                placeholder="Código, descripción o color…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Select aria-label="Marca" className="w-44" value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
              <option value="">Todas las marcas</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Select>
            <Select aria-label="Fábrica" className="w-48" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Todas las fábricas</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={verInactivos}
                onChange={(e) => setVerInactivos(e.target.checked)}
              />
              Ver inactivos
            </label>
          </div>
        )
      )}

      {loading ? (
        <TableSkeleton columnas={[8, 14, 30, 12, 12, 12, 12]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio
          icono={Package}
          titulo="Sin productos todavía"
          descripcion={puedeEditar ? 'Crea el primero con «Nuevo». Antes puedes cargar marcas y tamaños en Catálogos.' : undefined}
        />
      ) : filtrados.length === 0 ? (
        <Vacio icono={Package} titulo="Sin resultados" descripcion="Prueba con otra búsqueda o filtro." />
      ) : (
        <TablaScroll total={filtrados.length} clave={`${busqueda}|${marcaId}|${proveedorId}|${verInactivos}`}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="w-14 px-4 py-2.5 font-medium"></th>
                  <th className="px-4 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Descripción</th>
                  <th className="px-4 py-2.5 font-medium">Colores</th>
                  <th className="px-4 py-2.5 font-medium">Marca</th>
                  <th className="px-4 py-2.5 font-medium">Tamaños</th>
                  <th className="px-4 py-2.5 text-right font-medium">Costo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Venta USD</th>
                  <th className="px-4 py-2.5 text-right font-medium">Venta Gs</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, limite).map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setModal(p)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setModal(p)
                      }
                    }}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-1.5">
                      {p.fotoId ? (
                        <img
                          src={urlMiniatura(p.fotoId, 120)}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="size-10 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span className="flex size-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                          <ImageOff className="size-4" />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-foreground">
                      {p.codigo}
                      {!p.activo && (
                        <Badge className="ml-2" tono="neutral">
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{p.descripcion}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.colores.join(', ') || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{nombreMarca.get(p.marcaId) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{resumenTamanos(p.tamanoIds, nombreTamano)}</td>
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">{formatUsd(p.precioCosto)}</td>
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-foreground">{formatUsd(p.precioVentaUsd)}</td>
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-foreground">{formatGs(p.precioVentaGs)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <ProductoFormModal
        abierto={modal !== null}
        producto={modal === 'nuevo' ? null : modal}
        puedeEditar={puedeEditar}
        onCerrar={() => setModal(null)}
        onBorrar={(p) => {
          setABorrar(p)
          setModal(null)
        }}
      />

      <ConfirmModal
        abierto={aBorrar !== null}
        titulo="Borrar producto"
        textoConfirmar="Borrar"
        procesando={borrando}
        mensaje={
          <>
            ¿Borrar <strong>{aBorrar?.codigo}</strong> y sus fotos? Si ya está en pedidos, desactívalo en lugar de borrarlo.
          </>
        }
        onCancelar={() => setABorrar(null)}
        onConfirmar={async () => {
          if (!aBorrar) return
          setBorrando(true)
          const { error: err } = await borrar(aBorrar.id)
          setBorrando(false)
          if (err) toast.error(err)
          else {
            toast.success('Producto borrado.')
            refetch()
          }
          setABorrar(null)
        }}
      />
    </div>
  )
}

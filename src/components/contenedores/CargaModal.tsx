import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BadgeEstadoPedido } from '@/components/pedidos/badges'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useContenedores } from '@/hooks/useContenedores'
import { usePedidos } from '@/hooks/usePedidos'
import { formatCantidad, normalizar } from '@/lib/format'
import { agruparPorProducto, pendienteLinea } from '@/lib/pedidos'
import type { Contenedor, LineaPedido } from '@/lib/tipos'

interface LineaCarga {
  l: LineaPedido
  /** Lo máximo que puede llevar este contenedor: lo pendiente más lo que ya lleva. */
  maximo: number
}

/** Un producto de un color cuyas líneas tienen curva: se carga por cajas. */
interface GrupoCajas {
  tipo: 'cajas'
  clave: string
  codigo: string
  descripcion: string
  color: string
  lineas: LineaCarga[]
  porCaja: number
  maxCajas: number
  /** Cajas que ya lleva este contenedor. */
  actuales: number
}

/** Línea sin curva (o con unidades sueltas): se carga por unidades. */
interface ItemUnidades {
  tipo: 'unidades'
  linea: LineaCarga
}

type Item = GrupoCajas | ItemUnidades

const num = (s: string | undefined) => Number((s ?? '').replace(',', '.')) || 0

/**
 * Asigna a un contenedor en preparación lo que lleva de cada pedido. Si las líneas
 * de un color tienen curva, se indican las cajas (unidades = curva × cajas); si no,
 * unidades por línea. Un pedido puede repartirse en varios contenedores y un
 * contenedor lleva varios pedidos.
 */
export function CargaModal({
  abierto,
  contenedor,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  contenedor: Contenedor
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { data: pedidos } = usePedidos()
  const { guardarCargas, refetch } = useContenedores()
  const { nombres: nombreProveedor } = useCatalogo('proveedores')

  /** Cajas por grupo (clave) y unidades por línea (id), como texto. */
  const [cajas, setCajas] = useState<Record<string, string>>({})
  const [unidades, setUnidades] = useState<Record<string, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  /** lineaId → cantidad que ya lleva ESTE contenedor. */
  const enEste = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of contenedor.cargas) m.set(c.lineaId, (m.get(c.lineaId) ?? 0) + c.cantidad)
    return m
  }, [contenedor.cargas])

  /** Items cargables de cada pedido (cancelados y entregados fuera). */
  const candidatos = useMemo(() => {
    const q = normalizar(busqueda)
    return pedidos
      .filter((p) => p.estado !== 'cancelado' && p.estado !== 'entregado')
      .map((p) => {
        const todas: LineaCarga[] = agruparPorProducto(p.lineas).map((l) => ({
          l,
          maximo: pendienteLinea(l) + (enEste.get(l.id) ?? 0),
        }))
        // Agrupa por producto y color conservando el orden.
        const grupos = new Map<string, LineaCarga[]>()
        for (const x of todas) {
          const k = `${p.id}|${x.l.productoId}|${x.l.color}`
          grupos.set(k, [...(grupos.get(k) ?? []), x])
        }
        const items: Item[] = []
        for (const [clave, lineas] of grupos) {
          const conCurva = lineas.every((x) => x.l.porCaja > 0 && x.l.cajas > 0)
          // Las cajas que ya lleva el contenedor deben ser las mismas en todos los tamaños.
          const actuales = conCurva ? lineas.map((x) => (enEste.get(x.l.id) ?? 0) / x.l.porCaja) : []
          const regular = conCurva && actuales.every((a) => Number.isInteger(a) && a === actuales[0])
          if (regular) {
            const maxCajas = Math.min(...lineas.map((x) => Math.floor(x.maximo / x.l.porCaja)))
            if (maxCajas > 0 || actuales[0] > 0) {
              items.push({
                tipo: 'cajas',
                clave,
                codigo: lineas[0].l.codigo,
                descripcion: lineas[0].l.descripcion,
                color: lineas[0].l.color,
                lineas,
                porCaja: lineas.reduce((s, x) => s + x.l.porCaja, 0),
                maxCajas,
                actuales: actuales[0],
              })
            }
            continue
          }
          for (const x of lineas) if (x.maximo > 0) items.push({ tipo: 'unidades', linea: x })
        }
        return { p, items }
      })
      .filter(({ p, items }) => {
        if (items.length === 0) return false
        if (!q) return true
        return normalizar(
          `${p.folio} ${nombreProveedor.get(p.proveedorId) ?? ''}`,
        ).includes(q)
      })
  }, [pedidos, enEste, busqueda, nombreProveedor])

  // Al abrir: lo que ya lleva el contenedor.
  useEffect(() => {
    if (!abierto) return
    const c: Record<string, string> = {}
    const u: Record<string, string> = {}
    for (const { items } of candidatos) {
      for (const it of items) {
        if (it.tipo === 'cajas') {
          if (it.actuales > 0) c[it.clave] = String(it.actuales)
        } else if (enEste.has(it.linea.l.id)) u[it.linea.l.id] = String(enEste.get(it.linea.l.id))
      }
    }
    setCajas(c)
    setUnidades(u)
    setBusqueda('')
    setError(null)
    // Solo al abrir: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, contenedor.id])

  /** Unidades que llevaría este contenedor con lo escrito (de todo lo visible). */
  const total = useMemo(() => {
    let t = 0
    for (const { items } of candidatos) {
      for (const it of items) {
        t += it.tipo === 'cajas' ? num(cajas[it.clave]) * it.porCaja : num(unidades[it.linea.l.id])
      }
    }
    return t
  }, [candidatos, cajas, unidades])

  function cargarPedido(items: Item[]) {
    setCajas((c) => ({
      ...c,
      ...Object.fromEntries(items.flatMap((it) => (it.tipo === 'cajas' ? [[it.clave, String(it.maxCajas)]] : []))),
    }))
    setUnidades((u) => ({
      ...u,
      ...Object.fromEntries(items.flatMap((it) => (it.tipo === 'unidades' ? [[it.linea.l.id, String(it.linea.maximo)]] : []))),
    }))
  }

  function vaciarPedido(items: Item[]) {
    setCajas((c) => ({ ...c, ...Object.fromEntries(items.flatMap((it) => (it.tipo === 'cajas' ? [[it.clave, '']] : []))) }))
    setUnidades((u) => ({
      ...u,
      ...Object.fromEntries(items.flatMap((it) => (it.tipo === 'unidades' ? [[it.linea.l.id, '']] : []))),
    }))
  }

  async function onGuardar() {
    const cargas: { lineaId: string; cantidad: number }[] = []
    const visibles = new Set<string>()
    for (const { p, items } of candidatos) {
      for (const it of items) {
        if (it.tipo === 'cajas') {
          const n = num(cajas[it.clave])
          const etiqueta = `${p.folio} / ${it.codigo} ${it.color}`.trim()
          if (n < 0) return setError(`${etiqueta}: las cajas no pueden ser negativas.`)
          if (!Number.isInteger(n)) return setError(`${etiqueta}: las cajas deben ser un número entero.`)
          if (n > it.maxCajas) return setError(`${etiqueta}: máximo ${formatCantidad(it.maxCajas)} cajas disponibles.`)
          for (const x of it.lineas) {
            visibles.add(x.l.id)
            if (n > 0) cargas.push({ lineaId: x.l.id, cantidad: n * x.l.porCaja })
          }
        } else {
          const { l, maximo } = it.linea
          const n = num(unidades[l.id])
          visibles.add(l.id)
          if (n < 0) return setError(`${p.folio} / ${l.codigo}: la cantidad no puede ser negativa.`)
          if (n > maximo) return setError(`${p.folio} / ${l.codigo}: máximo ${formatCantidad(maximo)} disponibles.`)
          if (n > 0) cargas.push({ lineaId: l.id, cantidad: n })
        }
      }
    }
    // Lo que ya llevaba el contenedor y quedó fuera del filtro de búsqueda se conserva.
    for (const [lineaId, cantidad] of enEste) if (!visibles.has(lineaId)) cargas.push({ lineaId, cantidad })

    setGuardando(true)
    setError(null)
    const { error: err } = await guardarCargas(contenedor.id, cargas)
    setGuardando(false)
    if (err) return setError(err)
    toast.success('Carga guardada.')
    refetch()
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={`Carga de ${contenedor.numero}`}
      descripcion="Indica cuántas cajas de cada color viajan en este contenedor, o carga el pedido completo. Lo que no cargues queda disponible para otro."
      onCerrar={onCerrar}
      ancho="max-w-4xl"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {formatCantidad(total)} unidades en este contenedor
          </span>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar carga'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar pedido"
            className="pl-9"
            placeholder="Folio o fábrica…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {candidatos.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No hay pedidos con productos pendientes de cargar.
          </p>
        ) : (
          candidatos.map(({ p, items }) => (
            <section key={p.id} className="overflow-hidden rounded-md border border-border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-3 py-2">
                <p className="text-sm">
                  <span className="font-semibold text-foreground">{p.folio}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {nombreProveedor.get(p.proveedorId) ?? '—'}
                  </span>
                </p>
                <span className="flex items-center gap-2">
                  {p.estado !== 'fabricado' && p.estado !== 'embarcado' && p.estado !== 'en_transito' && (
                    <span className="text-xs text-warning">Aún no está fabricado</span>
                  )}
                  <BadgeEstadoPedido estado={p.estado} />
                  <Button variant="ghost" size="sm" onClick={() => vaciarPedido(items)}>
                    Quitar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => cargarPedido(items)}>
                    Cargar pedido completo
                  </Button>
                </span>
              </header>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((it) =>
                    it.tipo === 'cajas' ? (
                      <tr key={it.clave} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5">
                          <span className="font-medium text-foreground">{it.codigo}</span>{' '}
                          <span className="text-xs text-muted-foreground">
                            {it.descripcion}
                            {it.color && ` · ${it.color}`}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            Curva: {it.lineas.map((x) => `${x.l.tamano || '·'}×${x.l.porCaja}`).join('  ')} ={' '}
                            {formatCantidad(it.porCaja)} por caja
                          </p>
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted-foreground">
                          disponibles {formatCantidad(it.maxCajas)} cajas
                        </td>
                        <td className="w-24 px-3 py-1.5">
                          <Input
                            inputMode="numeric"
                            aria-label={`Cajas de ${it.codigo} ${it.color} en ${p.folio}`}
                            className="h-8 text-right text-xs"
                            placeholder="0 cajas"
                            value={cajas[it.clave] ?? ''}
                            onChange={(e) => setCajas((c) => ({ ...c, [it.clave]: e.target.value }))}
                          />
                        </td>
                        <td className="tabular w-28 whitespace-nowrap px-3 py-1.5 text-right text-xs text-foreground">
                          = {formatCantidad(num(cajas[it.clave]) * it.porCaja)} unid.
                        </td>
                      </tr>
                    ) : (
                      <tr key={it.linea.l.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5">
                          <span className="font-medium text-foreground">{it.linea.l.codigo}</span>{' '}
                          <span className="text-xs text-muted-foreground">
                            {it.linea.l.descripcion}
                            {[it.linea.l.color, it.linea.l.tamano].filter(Boolean).map((x) => ` · ${x}`).join('')}
                          </span>
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted-foreground">
                          disponible {formatCantidad(it.linea.maximo)} de {formatCantidad(it.linea.l.cantidad)}
                        </td>
                        <td className="w-24 px-3 py-1.5">
                          <Input
                            inputMode="decimal"
                            aria-label={`Cantidad de ${it.linea.l.codigo} en ${p.folio}`}
                            className="h-8 text-right text-xs"
                            placeholder="0 unid."
                            value={unidades[it.linea.l.id] ?? ''}
                            onChange={(e) => setUnidades((u) => ({ ...u, [it.linea.l.id]: e.target.value }))}
                          />
                        </td>
                        <td className="w-28"></td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </section>
          ))
        )}

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

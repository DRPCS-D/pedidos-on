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
import { pendienteLinea } from '@/lib/pedidos'
import type { Contenedor } from '@/lib/tipos'

/**
 * Asigna a un contenedor en preparación cuánto de cada línea de pedido lleva.
 * El máximo de una línea es lo que aún no está en otros contenedores. Un pedido
 * puede repartirse en varios contenedores y un contenedor lleva varios pedidos.
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
  const { nombres: nombreCliente } = useCatalogo('clientes')

  const [valores, setValores] = useState<Record<string, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  /** lineaId → cantidad que ya lleva ESTE contenedor. */
  const enEste = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of contenedor.cargas) m.set(c.lineaId, (m.get(c.lineaId) ?? 0) + c.cantidad)
    return m
  }, [contenedor.cargas])

  useEffect(() => {
    if (!abierto) return
    setValores(Object.fromEntries([...enEste].map(([id, n]) => [id, String(n)])))
    setBusqueda('')
    setError(null)
    // Solo al abrir: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, contenedor.id])

  /** Pedidos con algo por cargar (o ya en este contenedor), sin cancelados ni entregados. */
  const candidatos = useMemo(() => {
    const q = normalizar(busqueda)
    return pedidos
      .filter((p) => p.estado !== 'cancelado' && p.estado !== 'entregado')
      .map((p) => ({
        p,
        lineas: p.lineas
          .map((l) => ({ l, maximo: pendienteLinea(l) + (enEste.get(l.id) ?? 0) }))
          .filter((x) => x.maximo > 0),
      }))
      .filter(({ p, lineas }) => {
        if (lineas.length === 0) return false
        if (!q) return true
        return normalizar(
          `${p.folio} ${nombreProveedor.get(p.proveedorId) ?? ''} ${nombreCliente.get(p.clienteId) ?? ''}`,
        ).includes(q)
      })
  }, [pedidos, enEste, busqueda, nombreProveedor, nombreCliente])

  const total = Object.values(valores).reduce((s, v) => s + (Number(v.replace(',', '.')) || 0), 0)

  async function onGuardar() {
    const cargas: { lineaId: string; cantidad: number }[] = []
    for (const { p, lineas } of candidatos) {
      for (const { l, maximo } of lineas) {
        const n = Number((valores[l.id] ?? '').replace(',', '.')) || 0
        if (n < 0) return setError(`${p.folio} / ${l.codigo}: la cantidad no puede ser negativa.`)
        if (n > maximo) return setError(`${p.folio} / ${l.codigo}: máximo ${formatCantidad(maximo)} disponibles.`)
        if (n > 0) cargas.push({ lineaId: l.id, cantidad: n })
      }
    }
    // Lo que ya llevaba el contenedor y quedó fuera del filtro de búsqueda se conserva.
    const visibles = new Set(candidatos.flatMap(({ lineas }) => lineas.map(({ l }) => l.id)))
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
      descripcion="Indica cuántas unidades de cada producto viajan en este contenedor. Lo que no cargues queda disponible para otro."
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
            placeholder="Folio, fábrica o cliente…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {candidatos.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No hay pedidos con productos pendientes de cargar.
          </p>
        ) : (
          candidatos.map(({ p, lineas }) => (
            <section key={p.id} className="overflow-hidden rounded-md border border-border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-3 py-2">
                <p className="text-sm">
                  <span className="font-semibold text-foreground">{p.folio}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {nombreProveedor.get(p.proveedorId) ?? '—'} → {nombreCliente.get(p.clienteId) ?? 'Stock'}
                  </span>
                </p>
                <span className="flex items-center gap-2">
                  {p.estado !== 'fabricado' && p.estado !== 'embarcado' && p.estado !== 'en_transito' && (
                    <span className="text-xs text-warning">Aún no está fabricado</span>
                  )}
                  <BadgeEstadoPedido estado={p.estado} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setValores((v) => ({
                        ...v,
                        ...Object.fromEntries(lineas.map(({ l, maximo }) => [l.id, String(maximo)])),
                      }))
                    }
                  >
                    Cargar todo
                  </Button>
                </span>
              </header>
              <table className="w-full text-sm">
                <tbody>
                  {lineas.map(({ l, maximo }) => (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">
                        <span className="font-medium text-foreground">{l.codigo}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {l.descripcion}
                          {l.color && ` · ${l.color}`}
                        </span>
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted-foreground">
                        disponible {formatCantidad(maximo)} de {formatCantidad(l.cantidad)}
                      </td>
                      <td className="w-28 px-3 py-1.5">
                        <Input
                          inputMode="decimal"
                          aria-label={`Cantidad de ${l.codigo} en ${p.folio}`}
                          className="h-8 text-right text-xs"
                          placeholder="0"
                          value={valores[l.id] ?? ''}
                          onChange={(e) => setValores((v) => ({ ...v, [l.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
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

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BadgeEstadoPedido } from '@/components/pedidos/badges'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente, type AsignacionDatos } from '@/hooks/usePedidosCliente'
import { formatCantidad } from '@/lib/format'
import type { PedidoCliente } from '@/lib/tipos'

const num = (s: string | undefined) => Number((s ?? '').replace(',', '.')) || 0

/**
 * Asignación a mano: por cada línea que pidió el cliente, de qué pedidos a fábrica (de la
 * misma variante) se cubre y cuántas unidades de cada uno. Reemplaza lo asignado antes.
 */
export function AsignarModal({
  abierto,
  pedido,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  pedido: PedidoCliente
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { data: pedidos, refetch: refetchPedidos } = usePedidos()
  const { asignar, refetch } = usePedidosCliente()

  /** `${pcLineaId}|${lineaFabricaId}` → unidades, como texto. */
  const [valores, setValores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const v: Record<string, string> = {}
    for (const l of pedido.lineas) for (const a of l.asignaciones) v[`${l.id}|${a.lineaId}`] = String(a.cantidad)
    setValores(v)
    setError(null)
    // Solo al abrir: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, pedido.id])

  /** Para cada línea del cliente: líneas de pedidos a fábrica de la misma variante y cuánto queda libre en cada una. */
  const filas = useMemo(
    () =>
      pedido.lineas.map((l) => {
        const propias = new Map(l.asignaciones.map((a) => [a.lineaId, a.cantidad]))
        const candidatas = pedidos
          .filter((p) => p.estado !== 'cancelado')
          .flatMap((p) =>
            p.lineas
              .filter((f) => f.productoId === l.productoId && f.tamanoId === l.tamanoId && f.color.toUpperCase() === l.color.toUpperCase())
              .map((f) => ({ p, f, libre: f.cantidad - f.asignado + (propias.get(f.id) ?? 0) })),
          )
          .filter((x) => x.libre > 0)
        return { l, candidatas }
      }),
    [pedido, pedidos],
  )

  const total = Object.values(valores).reduce((s, v) => s + num(v), 0)

  async function onGuardar() {
    const lista: AsignacionDatos[] = []
    for (const { l, candidatas } of filas) {
      let suma = 0
      for (const { p, f, libre } of candidatas) {
        const n = num(valores[`${l.id}|${f.id}`])
        if (n < 0) return setError('Las cantidades no pueden ser negativas.')
        if (n > libre) return setError(`${p.folio} / ${l.codigo} ${l.color} ${l.tamano}: máximo ${formatCantidad(libre)} libres.`)
        suma += n
        if (n > 0) lista.push({ pcLineaId: l.id, lineaId: f.id, cantidad: n })
      }
      if (suma > l.cantidad) {
        return setError(`${l.codigo} ${l.color} ${l.tamano}: asignas ${formatCantidad(suma)} y el cliente pidió ${formatCantidad(l.cantidad)}.`)
      }
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await asignar(pedido.id, lista)
    setGuardando(false)
    if (err) return setError(err)
    toast.success('Asignación guardada.')
    refetch()
    refetchPedidos()
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={`Asignar ${pedido.folio} desde pedidos a fábrica`}
      descripcion="Para cada producto, color y tamaño que pidió el cliente, indica de qué pedido a fábrica sale. Lo que no se asigne queda pendiente de pedir."
      onCerrar={onCerrar}
      ancho="max-w-4xl"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted-foreground">{formatCantidad(total)} unidades asignadas</span>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar asignación'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {filas.map(({ l, candidatas }) => (
          <section key={l.id} className="overflow-hidden rounded-md border border-border">
            <header className="flex flex-wrap items-center justify-between gap-2 bg-secondary/50 px-3 py-1.5 text-sm">
              <span>
                <span className="font-medium text-foreground">{l.codigo}</span>{' '}
                <span className="text-xs text-muted-foreground">{[l.color, l.tamano].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="tabular text-xs text-muted-foreground">el cliente pidió {formatCantidad(l.cantidad)}</span>
            </header>
            {candidatas.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No hay pedidos a fábrica con esta variante disponible.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {candidatas.map(({ p, f, libre }) => (
                    <tr key={f.id} className="border-t border-border first:border-0">
                      <td className="px-3 py-1.5 font-medium text-foreground">{p.folio}</td>
                      <td className="px-3 py-1.5">
                        <BadgeEstadoPedido estado={p.estado} />
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-xs text-muted-foreground">libres {formatCantidad(libre)}</td>
                      <td className="w-24 px-3 py-1.5">
                        <Input
                          inputMode="decimal"
                          aria-label={`Unidades de ${p.folio} para ${l.codigo} ${l.color} ${l.tamano}`}
                          className="h-8 text-right text-xs"
                          placeholder="0"
                          value={valores[`${l.id}|${f.id}`] ?? ''}
                          onChange={(e) => setValores((v) => ({ ...v, [`${l.id}|${f.id}`]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

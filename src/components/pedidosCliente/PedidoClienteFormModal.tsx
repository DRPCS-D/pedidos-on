import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EditorProductos, lineasDeGrupos, totalesDeGrupos, useConstructorGrupos, type GrupoForm } from '@/components/pedidos/EditorProductos'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { formatCantidad, formatGs, formatUsd, hoyIso } from '@/lib/format'
import type { PedidoCliente } from '@/lib/tipos'

const num = (t: string | undefined) => Number((t ?? '').replace(',', '.')) || 0

/**
 * Suma las cantidades de `g` a las de `x` (mismo producto). Si el color tiene la misma curva se
 * suman las cajas; si no, las curvas no se pueden combinar y queda el total de cada tamaño como 1 caja.
 */
function sumarGrupo(x: GrupoForm, g: GrupoForm): GrupoForm {
  const colores = [...x.ejes.colores, ...g.ejes.colores.filter((c) => !x.ejes.colores.includes(c))]
  const tamanos = [...x.ejes.tamanos, ...g.ejes.tamanos.filter((t) => !x.ejes.tamanos.some((u) => u.id === t.id))]
  const cantidades = { ...x.cantidades }
  for (const [k, v] of Object.entries(g.cantidades)) cantidades[k] = String(num(cantidades[k]) + num(v))
  const curva = { ...x.curva }
  const cajas = { ...x.cajas }
  for (const color of g.ejes.colores) {
    const a = x.curva[color] ?? {}
    const b = g.curva[color] ?? {}
    const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    if (ids.length === 0) continue
    if (num(x.cajas[color]) > 0 && ids.every((id) => num(a[id]) === num(b[id]))) {
      cajas[color] = String(num(x.cajas[color]) + num(g.cajas[color]))
    } else {
      const total: Record<string, string> = {}
      for (const id of ids) total[id] = String(num(a[id]) * (num(x.cajas[color]) || 1) + num(b[id]) * (num(g.cajas[color]) || 1))
      curva[color] = total
      cajas[color] = '1'
    }
  }
  return { ...x, ejes: { ...x.ejes, colores, tamanos }, cantidades, curva, cajas }
}

export function PedidoClienteFormModal({
  abierto,
  pedido,
  clienteInicial,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** null = crear */
  pedido: PedidoCliente | null
  /** Cliente preseleccionado al crear. */
  clienteInicial?: string
  onCerrar: () => void
  /** Recibe el id del pedido guardado, para ir a su detalle. */
  onGuardado: (id: string) => void
}) {
  const { data: clientes } = useCatalogo('clientes')
  const { guardar, refetch } = usePedidosCliente()
  const { deLineas } = useConstructorGrupos()
  const { data: pedidosFabrica } = usePedidos()
  const { nombres: nombreProveedor } = useCatalogo('proveedores')
  const [pedidoFabricaId, setPedidoFabricaId] = useState('')

  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoyIso())
  const [notas, setNotas] = useState('')
  const [grupos, setGrupos] = useState<GrupoForm[]>([])
  const [asignar, setAsignar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setClienteId(pedido?.clienteId ?? clienteInicial ?? '')
    setFecha(pedido?.fecha || hoyIso())
    setNotas(pedido?.notas ?? '')
    setGrupos(pedido ? deLineas(pedido.lineas.map((l) => ({ ...l, marca: l.marca, comprometido: l.asignado }))) : [])
    setAsignar(true)
    setError(null)
    // Solo al abrir o cambiar de pedido: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, pedido?.id])

  const totales = totalesDeGrupos(grupos)

  /** Agrega lo que aún no está asignado a otros clientes de un pedido a fábrica. */
  function traerPedidoFabrica() {
    const ped = pedidosFabrica.find((x) => x.id === pedidoFabricaId)
    if (!ped) return
    const lineas = ped.lineas
      .map((l) => {
        const libre = l.cantidad - l.asignado
        const entera = libre === l.cantidad
        return {
          ...l,
          id: '',
          cantidad: libre,
          porCaja: entera ? l.porCaja : 0,
          cajas: entera ? l.cajas : 0,
          comprometido: 0,
        }
      })
      .filter((l) => l.cantidad > 0)
    if (lineas.length === 0) return toast.info('Ese pedido ya está asignado por completo.')
    setGrupos((gs) => {
      let r = gs
      for (const g of deLineas(lineas)) {
        r = r.some((x) => x.productoId === g.productoId)
          ? r.map((x) => (x.productoId === g.productoId ? sumarGrupo(x, g) : x))
          : [...r, g]
      }
      return r
    })
    setPedidoFabricaId('')
  }

  async function onGuardar() {
    if (!clienteId) return setError('Elige el cliente.')
    if (!fecha) return setError('Indica la fecha del pedido.')
    if (grupos.length === 0) return setError('Agrega al menos un producto.')
    const r = lineasDeGrupos(grupos, 'asignados desde pedidos a fábrica')
    if (r.lineas === null) return setError(r.error)

    setGuardando(true)
    setError(null)
    const { error: err, data } = await guardar(pedido?.id ?? null, {
      clienteId,
      fecha,
      notas: notas.trim(),
      lineas: r.lineas,
      asignar,
    })
    setGuardando(false)
    if (err || !data) return setError(err ?? 'No se pudo guardar el pedido.')
    const aviso = data.asignado ? ` Se asignaron ${formatCantidad(data.asignado)} unidades desde pedidos a fábrica.` : ''
    toast.success(pedido ? 'Pedido actualizado.' : `Pedido ${data.folio} creado.${aviso}`)
    refetch()
    onGuardado(data.id)
  }

  return (
    <Modal
      abierto={abierto}
      titulo={pedido ? `Editar ${pedido.folio}` : 'Nuevo pedido de cliente'}
      onCerrar={onCerrar}
      ancho="max-w-5xl"
      footer={
        <>
          <span className="tabular mr-auto self-center text-xs text-muted-foreground">
            {totales.unidades.toLocaleString('es-PY')} unidades · venta {formatUsd(totales.ventaUsd)} / {formatGs(totales.ventaGs)}
          </span>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : pedido ? 'Guardar' : 'Crear pedido'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cliente *">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Elegir…</option>
              {clientes
                .filter((c) => c.activo || c.id === clienteId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Fecha del pedido *">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Notas">
            <Textarea className="min-h-9.5" rows={1} value={notas} maxLength={2000} onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </div>

        {!pedido && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-primary/30 bg-accent/60 px-3 py-2.5">
            <Field label="Traer un pedido a fábrica completo" className="min-w-64 flex-1">
              <Select value={pedidoFabricaId} onChange={(e) => setPedidoFabricaId(e.target.value)}>
                <option value="">Elegir pedido…</option>
                {pedidosFabrica
                  .filter((x) => x.estado !== 'cancelado' && x.lineas.some((l) => l.cantidad > l.asignado))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.folio} · {nombreProveedor.get(x.proveedorId) ?? '—'}
                    </option>
                  ))}
              </Select>
            </Field>
            <Button variant="outline" onClick={traerPedidoFabrica} disabled={!pedidoFabricaId}>
              Traer productos
            </Button>
          </div>
        )}

        <EditorProductos
          grupos={grupos}
          setGrupos={setGrupos}
          modo="cliente"
          textoComprometido="asignados desde pedidos a fábrica"
        />

        {!pedido && (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={asignar}
              onChange={(e) => setAsignar(e.target.checked)}
            />
            <span>
              Al guardar, cubrir con lo que ya esté disponible en pedidos a fábrica (lo que falte quedará pendiente de pedir a la
              fábrica).
            </span>
          </label>
        )}

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { usePedidos } from '@/hooks/usePedidos'
import { usePedidosCliente } from '@/hooks/usePedidosCliente'
import { useProductos } from '@/hooks/useProductos'
import { formatCantidad, formatUsd, hoyIso } from '@/lib/format'
import { claveCelda } from '@/lib/grilla'
import { pendientesDeClientes } from '@/lib/pedidoCliente'
import { totalConAjustes } from '@/lib/pedidos'
import type { Pedido } from '@/lib/tipos'
import { AJUSTES_VACIOS, AjustesCostoEditor, ajustesDePedido, ajustesNumericos, type AjustesForm } from './AjustesCostoEditor'
import {
  EditorProductos,
  lineasDeGrupos,
  totalesDeGrupos,
  useConstructorGrupos,
  type GrupoForm,
} from './EditorProductos'

export function PedidoFormModal({
  abierto,
  pedido,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** null = crear */
  pedido: Pedido | null
  onCerrar: () => void
  /** Recibe el id del pedido guardado, para ir a su detalle. */
  onGuardado: (id: string) => void
}) {
  const { data: proveedores } = useCatalogo('proveedores')
  const { porId } = useProductos()
  const { data: pedidosCliente, refetch: refetchClientes, asignarAutomatico } = usePedidosCliente()
  const { guardar, refetch } = usePedidos()
  const { deProducto, deLineas } = useConstructorGrupos()

  const [proveedorId, setProveedorId] = useState('')
  const [fecha, setFecha] = useState(hoyIso())
  const [notas, setNotas] = useState('')
  const [grupos, setGrupos] = useState<GrupoForm[]>([])
  const [ajustes, setAjustes] = useState<AjustesForm>(AJUSTES_VACIOS)
  const [asignar, setAsignar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setProveedorId(pedido?.proveedorId ?? '')
    setFecha(pedido?.fechaPedido || hoyIso())
    setNotas(pedido?.notas ?? '')
    setGrupos(
      pedido
        ? deLineas(pedido.lineas.map((l) => ({ ...l, comprometido: Math.max(l.cargado, l.asignado) })))
        : [],
    )
    setAjustes(pedido ? ajustesDePedido(pedido) : AJUSTES_VACIOS)
    setAsignar(true)
    setError(null)
    // Solo al abrir o cambiar de pedido: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, pedido?.id])

  /** Lo que los clientes piden y aún no está cubierto, de productos de esta fábrica (o sin fábrica fija). */
  const pendientes = useMemo(
    () =>
      pendientesDeClientes(pedidosCliente).filter((x) => {
        const prod = porId.get(x.productoId)
        return !!prod && (!prod.proveedorId || prod.proveedorId === proveedorId)
      }),
    [pedidosCliente, porId, proveedorId],
  )
  const unidadesPendientes = pendientes.reduce((s, x) => s + x.cantidad, 0)

  /** Agrega los productos que los clientes están esperando, con lo que falta como cantidad. */
  function agregarPendientes() {
    const nuevos: GrupoForm[] = []
    for (const productoId of new Set(pendientes.map((x) => x.productoId))) {
      if (grupos.some((g) => g.productoId === productoId)) continue
      const prod = porId.get(productoId)
      if (!prod) continue
      const g = deProducto(prod)
      for (const x of pendientes.filter((y) => y.productoId === productoId)) {
        const color = g.ejes.colores.find((c) => c.toUpperCase() === x.color.toUpperCase())
        if (color === undefined) continue
        g.cantidades[claveCelda(color, x.tamanoId)] = String(x.cantidad)
        // Se muestra como la curva de 1 caja; se puede ajustar a las cajas reales.
        if (x.tamanoId) {
          g.curva[color] = { ...g.curva[color], [x.tamanoId]: String(x.cantidad) }
          g.cajas[color] = '1'
        }
      }
      nuevos.push(g)
    }
    if (nuevos.length === 0) return toast.info('Esos productos ya están en el pedido.')
    setGrupos((gs) => [...gs, ...nuevos])
  }

  const totales = totalesDeGrupos(grupos)
  const totalCosto = totalConAjustes(totales.costo, ajustesNumericos(ajustes)).total

  async function onGuardar() {
    if (!proveedorId) return setError('Elige la fábrica (proveedor).')
    if (!fecha) return setError('Indica la fecha del pedido.')
    if (grupos.length === 0) return setError('Agrega al menos un producto.')
    const r = lineasDeGrupos(grupos, 'cargados en contenedores o asignados a clientes')
    if (r.lineas === null) return setError(r.error)

    setGuardando(true)
    setError(null)
    const { error: err, data } = await guardar(pedido?.id ?? null, {
      proveedorId,
      fechaPedido: fecha,
      notas: notas.trim(),
      ...ajustesNumericos(ajustes),
      lineas: r.lineas,
    })
    if (err || !data) {
      setGuardando(false)
      return setError(err ?? 'No se pudo guardar el pedido.')
    }
    let aviso = ''
    if (!pedido && asignar && unidadesPendientes > 0) {
      const a = await asignarAutomatico()
      if (a.data?.asignado) aviso = ` ${formatCantidad(a.data.asignado)} unidades asignadas a pedidos de clientes.`
      refetchClientes()
    }
    setGuardando(false)
    toast.success(pedido ? 'Pedido actualizado.' : `Pedido ${data.folio} creado.${aviso}`)
    refetch()
    onGuardado(data.id)
  }

  return (
    <Modal
      abierto={abierto}
      titulo={pedido ? `Editar ${pedido.folio}` : 'Nuevo pedido a fábrica'}
      onCerrar={onCerrar}
      ancho="max-w-5xl"
      footer={
        <>
          <span className="tabular mr-auto self-center text-xs text-muted-foreground">
            {totales.unidades.toLocaleString('es-PY')} unidades · costo {formatUsd(totalCosto)}
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
          <Field label="Fábrica (proveedor) *">
            <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Elegir…</option>
              {proveedores
                .filter((p) => p.activo || p.id === proveedorId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
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

        {proveedorId && unidadesPendientes > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-accent/60 px-3 py-2.5">
            <p className="text-sm text-foreground">
              Los clientes esperan <strong>{formatCantidad(unidadesPendientes)} unidades</strong> de productos de esta fábrica que aún no
              se pidieron.
            </p>
            <Button variant="outline" size="sm" onClick={agregarPendientes}>
              Agregar lo pendiente de clientes
            </Button>
          </div>
        )}

        <EditorProductos
          grupos={grupos}
          setGrupos={setGrupos}
          proveedorId={proveedorId}
          modo="fabrica"
          textoComprometido="cargados o asignados"
        />

        <AjustesCostoEditor valor={ajustes} onChange={setAjustes} subtotal={totales.costo} />

        {!pedido && unidadesPendientes > 0 && (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={asignar}
              onChange={(e) => setAsignar(e.target.checked)}
            />
            <span>
              Al guardar, asignar este pedido a los pedidos de clientes que lo están esperando (lo que sobre queda como stock propio).
            </span>
          </label>
        )}

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

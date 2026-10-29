import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { usePedidos, type DatosLinea } from '@/hooks/usePedidos'
import { useProductos } from '@/hooks/useProductos'
import { formatGs, formatUsd, hoyIso, normalizar } from '@/lib/format'
import {
  cantidadesDeCurva,
  claveCelda,
  claveDeLinea,
  ejesGrilla,
  totalGrilla,
  unidadesPorCaja,
  type EjesGrilla,
  type TamanoRef,
} from '@/lib/grilla'
import { totalesLineas } from '@/lib/pedidos'
import type { Pedido, Producto } from '@/lib/tipos'

/**
 * Un producto dentro del pedido, con su grilla color × tamaño. Cada celda con
 * cantidad es una línea del pedido; los precios valen para todas. Los números
 * son texto para poder escribir «1,» sin que se pierda.
 */
interface GrupoForm {
  clave: string
  productoId: string
  codigo: string
  descripcion: string
  detalle: string
  ejes: EjesGrilla
  cantidades: Record<string, string>
  /** Id de la línea ya guardada de cada celda. */
  ids: Record<string, string>
  /** Cantidad ya cargada en contenedores de cada celda. */
  cargados: Record<string, number>
  precioCosto: string
  precioVentaUsd: string
  precioVentaGs: string
  /** Curva de cada color: unidades por caja de cada tamaño (color → id de tamaño → texto). */
  curva: Record<string, Record<string, string>>
  /** Cajas de cada color. La cantidad de cada tamaño es curva × cajas. */
  cajas: Record<string, string>
}

const num = (s: string) => Number(s.replace(',', '.')) || 0
const texto = (n: number) => (n ? String(n) : '')

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
  const { data: clientes } = useCatalogo('clientes')
  const { nombres: marcas } = useCatalogo('marcas')
  const { nombres: nombreTamano } = useCatalogo('tamanos')
  const { data: productos, porId } = useProductos()
  const { guardar, refetch } = usePedidos()

  const [proveedorId, setProveedorId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoyIso())
  const [notas, setNotas] = useState('')
  const [grupos, setGrupos] = useState<GrupoForm[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const tamanosDe = (p: Producto): TamanoRef[] =>
    p.tamanoIds.map((id) => ({ id, nombre: nombreTamano.get(id) ?? '?' }))

  /** Arma los grupos de un pedido guardado: una línea = una celda del producto. */
  function gruposDe(ped: Pedido): GrupoForm[] {
    const porProducto = new Map<string, Pedido['lineas']>()
    for (const l of ped.lineas) porProducto.set(l.productoId, [...(porProducto.get(l.productoId) ?? []), l])
    return [...porProducto.entries()].map(([productoId, lineas]) => {
      const prod = porId.get(productoId)
      const ejes = ejesGrilla(prod?.colores ?? [], prod ? tamanosDe(prod) : [], lineas)
      const g: GrupoForm = {
        clave: productoId,
        productoId,
        codigo: lineas[0].codigo,
        descripcion: lineas[0].descripcion,
        detalle: lineas[0].marca,
        ejes,
        cantidades: {},
        ids: {},
        cargados: {},
        precioCosto: texto(lineas[0].precioCosto),
        precioVentaUsd: texto(lineas[0].precioVentaUsd),
        precioVentaGs: texto(lineas[0].precioVentaGs),
        curva: {},
        cajas: {},
      }
      for (const l of lineas) {
        const k = claveDeLinea(ejes, l)
        g.cantidades[k] = String(l.cantidad)
        g.ids[k] = l.id
        g.cargados[k] = l.cargado
        // Con curva guardada se recuperan unidades por caja y cajas; si no, la cantidad se muestra como 1 caja.
        const color = k.split('|')[0]
        const conCurva = l.porCaja > 0 && l.cajas > 0
        g.curva[color] = { ...g.curva[color], [l.tamanoId]: String(conCurva ? l.porCaja : l.cantidad) }
        g.cajas[color] = String(conCurva ? l.cajas : 1)
      }
      return g
    })
  }

  useEffect(() => {
    if (!abierto) return
    setProveedorId(pedido?.proveedorId ?? '')
    setClienteId(pedido?.clienteId ?? '')
    setFecha(pedido?.fechaPedido || hoyIso())
    setNotas(pedido?.notas ?? '')
    setGrupos(pedido ? gruposDe(pedido) : [])
    setBusqueda('')
    setError(null)
    // Solo al abrir o cambiar de pedido: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, pedido?.id])

  /** Productos activos que coinciden; los de la fábrica elegida salen primero. */
  const sugeridos = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return []
    return productos
      .filter((p) => p.activo && normalizar(`${p.codigo} ${p.descripcion} ${p.colores.join(' ')}`).includes(q))
      .sort((a, b) => Number(b.proveedorId === proveedorId) - Number(a.proveedorId === proveedorId))
      .slice(0, 8)
  }, [productos, busqueda, proveedorId])

  function agregar(p: Producto) {
    if (grupos.some((g) => g.productoId === p.id)) {
      toast.info(`${p.codigo} ya está en el pedido.`)
      return
    }
    const ejes = ejesGrilla(p.colores, tamanosDe(p), [])
    // Sin colores ni tamaños es una sola celda: ya viene con 1 unidad.
    const sinVariantes = ejes.colores.length === 1 && ejes.tamanos.length === 1 && !ejes.colores[0] && !ejes.tamanos[0].id
    setGrupos((gs) => [
      ...gs,
      {
        clave: `n${Date.now()}`,
        productoId: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        detalle: marcas.get(p.marcaId) ?? '',
        ejes,
        cantidades: sinVariantes ? { [claveCelda('', '')]: '1' } : {},
        ids: {},
        cargados: {},
        precioCosto: texto(p.precioCosto),
        precioVentaUsd: texto(p.precioVentaUsd),
        precioVentaGs: texto(p.precioVentaGs),
        curva: {},
        cajas: {},
      },
    ])
    setBusqueda('')
  }

  const cambiar = (clave: string, parche: Partial<GrupoForm>) =>
    setGrupos((gs) => gs.map((g) => (g.clave === clave ? { ...g, ...parche } : g)))

  /** Cantidad de cada tamaño de un color = unidades de su curva × sus cajas (vacío si no hay cajas). */
  function conCurva(g: GrupoForm, curva: GrupoForm['curva'], cajas: GrupoForm['cajas'], color: string): GrupoForm {
    const fila = cantidadesDeCurva(g.ejes.tamanos, curva[color] ?? {}, cajas[color] ?? '')
    const cantidades = { ...g.cantidades }
    for (const t of g.ejes.tamanos) cantidades[claveCelda(color, t.id)] = fila?.[t.id] ?? ''
    return { ...g, curva, cajas, cantidades }
  }

  const cambiarCurva = (g: GrupoForm, color: string, tamanoId: string, valor: string) =>
    setGrupos((gs) =>
      gs.map((x) =>
        x.clave === g.clave
          ? conCurva(x, { ...x.curva, [color]: { ...x.curva[color], [tamanoId]: valor } }, x.cajas, color)
          : x,
      ),
    )

  const cambiarCajas = (g: GrupoForm, color: string, valor: string) =>
    setGrupos((gs) =>
      gs.map((x) => (x.clave === g.clave ? conCurva(x, x.curva, { ...x.cajas, [color]: valor }, color) : x)),
    )

  const cambiarCelda = (g: GrupoForm, k: string, valor: string) =>
    cambiar(g.clave, { cantidades: { ...g.cantidades, [k]: valor } })

  const totales = totalesLineas(
    grupos.map((g) => ({
      cantidad: totalGrilla(g.cantidades),
      precioCosto: num(g.precioCosto),
      precioVentaUsd: num(g.precioVentaUsd),
      precioVentaGs: num(g.precioVentaGs),
    })),
  )

  async function onGuardar() {
    if (!proveedorId) return setError('Elige la fábrica (proveedor).')
    if (!fecha) return setError('Indica la fecha del pedido.')
    if (grupos.length === 0) return setError('Agrega al menos un producto.')

    const lineas: DatosLinea[] = []
    for (const g of grupos) {
      let conCantidad = 0
      for (const color of g.ejes.colores) {
        for (const t of g.ejes.tamanos) {
          const k = claveCelda(color, t.id)
          const cantidad = num(g.cantidades[k] ?? '')
          const etiqueta = [g.codigo, color, t.nombre].filter(Boolean).join(' ')
          if (cantidad < 0) return setError(`${etiqueta}: la cantidad no puede ser negativa.`)
          if (cantidad < (g.cargados[k] ?? 0)) return setError(`${etiqueta}: ya hay ${g.cargados[k]} cargados en contenedores.`)
          if (cantidad === 0) continue
          conCantidad++
          const conTamanos = t.id !== ''
          lineas.push({
            id: g.ids[k] ?? '',
            productoId: g.productoId,
            color,
            tamanoId: t.id,
            cantidad,
            // Curva y cajas se guardan para poder mostrar «5 cajas de esta curva».
            porCaja: conTamanos ? num(g.curva[color]?.[t.id] ?? '') : 0,
            cajas: conTamanos ? num(g.cajas[color] ?? '') : 0,
            precioCosto: num(g.precioCosto),
            precioVentaUsd: num(g.precioVentaUsd),
            precioVentaGs: num(g.precioVentaGs),
          })
        }
      }
      if (conCantidad === 0) return setError(`${g.codigo}: indica la cantidad de al menos un tamaño, o quita el producto.`)
    }

    setGuardando(true)
    setError(null)
    const { error: err, data } = await guardar(pedido?.id ?? null, {
      proveedorId,
      clienteId,
      fechaPedido: fecha,
      notas: notas.trim(),
      lineas,
    })
    setGuardando(false)
    if (err || !data) return setError(err ?? 'No se pudo guardar el pedido.')
    toast.success(pedido ? 'Pedido actualizado.' : `Pedido ${data.folio} creado.`)
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
            {totales.unidades.toLocaleString('es-PY')} unidades · costo {formatUsd(totales.costo)} · venta{' '}
            {formatUsd(totales.ventaUsd)} / {formatGs(totales.ventaGs)}
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
        <div className="grid gap-4 sm:grid-cols-4">
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
          <Field label="Cliente" hint="Vacío = stock propio.">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Sin cliente</option>
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
          <Field label="Notas" className="sm:col-span-1">
            <Textarea className="min-h-9.5" rows={1} value={notas} maxLength={2000} onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Productos</h3>
          <div className="relative mb-3 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar producto"
              className="pl-9"
              placeholder="Buscar producto por código, descripción o color para agregarlo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda.trim() && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {sugeridos.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias.</li>
                ) : (
                  sugeridos.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => agregar(p)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">{p.codigo}</span>{' '}
                          <span className="text-muted-foreground">{p.descripcion}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {p.colores.length > 0 && `${p.colores.length} col.`}
                          {p.colores.length > 0 && p.tamanoIds.length > 0 && ' · '}
                          {p.tamanoIds.length > 0 && `${p.tamanoIds.length} tam.`}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {grupos.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Aún no hay productos. Búscalos arriba: al agregar uno aparecen todos sus colores y tamaños para cargar las cantidades.
            </p>
          ) : (
            <div className="space-y-4">
              {grupos.map((g) => {
                const sinVariantes = g.ejes.colores.length === 1 && !g.ejes.colores[0] && g.ejes.tamanos.length === 1 && !g.ejes.tamanos[0].id
                const hayColores = !(g.ejes.colores.length === 1 && !g.ejes.colores[0])
                const bloqueado = Object.values(g.cargados).some((n) => n > 0)
                return (
                  <section key={g.clave} className="overflow-hidden rounded-md border border-border">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-3 py-2">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{g.codigo}</span>{' '}
                        <span className="text-muted-foreground">
                          {g.descripcion}
                          {g.detalle && ` · ${g.detalle}`}
                        </span>
                      </p>
                      <span className="flex items-center gap-3">
                        <span className="tabular text-xs text-muted-foreground">
                          {totalGrilla(g.cantidades).toLocaleString('es-PY')} unid.
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title={bloqueado ? 'Tiene unidades cargadas en un contenedor' : 'Quitar producto'}
                          aria-label={`Quitar ${g.codigo}`}
                          disabled={bloqueado}
                          onClick={() => setGrupos((gs) => gs.filter((x) => x.clave !== g.clave))}
                        >
                          <X />
                        </Button>
                      </span>
                    </header>

                    <div className="space-y-3 p-3">
                      {sinVariantes ? (
                        <label className="flex items-center gap-3 text-sm text-foreground">
                          Cantidad
                          <Input
                            inputMode="decimal"
                            aria-label={`Cantidad de ${g.codigo}`}
                            className="h-8 w-28 text-right text-xs"
                            value={g.cantidades[claveCelda('', '')] ?? ''}
                            onChange={(e) => cambiarCelda(g, claveCelda('', ''), e.target.value)}
                          />
                        </label>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="text-sm">
                              <thead>
                                <tr className="text-xs text-muted-foreground">
                                  <th className="pr-3 text-left font-medium">{hayColores ? 'Color' : ''}</th>
                                  {g.ejes.tamanos.map((t) => (
                                    <th key={t.id} className="px-1 pb-1 text-center font-medium">
                                      {t.nombre}
                                    </th>
                                  ))}
                                  <th className="px-2 pb-1 text-right font-medium">Por caja</th>
                                  <th className="px-1 pb-1 text-center font-medium">Cajas</th>
                                  <th className="px-2 pb-1 text-right font-medium">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.ejes.colores.map((color) => {
                                  const porCaja = unidadesPorCaja(g.curva[color] ?? {})
                                  const totalFila = totalGrilla(
                                    Object.fromEntries(g.ejes.tamanos.map((t) => [t.id, g.cantidades[claveCelda(color, t.id)] ?? ''])),
                                  )
                                  const cargadoFila = g.ejes.tamanos.reduce((n, t) => n + (g.cargados[claveCelda(color, t.id)] ?? 0), 0)
                                  return (
                                    <tr key={color}>
                                      <td className="whitespace-nowrap py-0.5 pr-3 text-foreground">{color}</td>
                                      {g.ejes.tamanos.map((t) => (
                                        <td key={t.id} className="px-1 py-0.5">
                                          <Input
                                            inputMode="decimal"
                                            aria-label={`Curva de ${[g.codigo, color].filter(Boolean).join(' ')}, unidades por caja del ${t.nombre}`}
                                            className="h-8 w-14 px-1 text-center text-xs"
                                            placeholder="0"
                                            value={g.curva[color]?.[t.id] ?? ''}
                                            onChange={(e) => cambiarCurva(g, color, t.id, e.target.value)}
                                          />
                                        </td>
                                      ))}
                                      <td className="tabular px-2 text-right text-xs text-muted-foreground">
                                        {porCaja.toLocaleString('es-PY')}
                                      </td>
                                      <td className="px-1 py-0.5">
                                        <Input
                                          inputMode="decimal"
                                          aria-label={`Cajas de ${[g.codigo, color].filter(Boolean).join(' ')}`}
                                          title={cargadoFila > 0 ? `${cargadoFila} unidades ya cargadas en contenedores` : undefined}
                                          className={`h-8 w-16 px-1 text-center text-xs ${cargadoFila > 0 ? 'border-warning' : ''}`}
                                          placeholder="0"
                                          value={g.cajas[color] ?? ''}
                                          onChange={(e) => cambiarCajas(g, color, e.target.value)}
                                        />
                                      </td>
                                      <td className="tabular px-2 text-right text-xs font-medium text-foreground">
                                        {totalFila.toLocaleString('es-PY')}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Escribe la curva de cada color (unidades de cada tamaño en una caja) y sus cajas. Total = unidades por caja ×
                            cajas (ej. 7 × 5 = 35).
                          </p>
                        </>
                      )}

                      <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                        <Field label="Costo USD (c/u)">
                          <Input
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={g.precioCosto}
                            onChange={(e) => cambiar(g.clave, { precioCosto: e.target.value })}
                          />
                        </Field>
                        <Field label="Venta USD (c/u)">
                          <Input
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={g.precioVentaUsd}
                            onChange={(e) => cambiar(g.clave, { precioVentaUsd: e.target.value })}
                          />
                        </Field>
                        <Field label="Venta Gs (c/u)">
                          <Input
                            inputMode="numeric"
                            className="h-8 text-xs"
                            value={g.precioVentaGs}
                            onChange={(e) => cambiar(g.clave, { precioVentaGs: e.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Los precios se copian del producto al agregarlo y valen para todos sus colores y tamaños; si luego cambian en el
            catálogo, este pedido no se altera.
          </p>
        </div>

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

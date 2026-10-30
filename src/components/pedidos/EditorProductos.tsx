import { Search, X } from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useCatalogo } from '@/hooks/useCatalogo'
import type { DatosLinea } from '@/hooks/usePedidos'
import { useProductos } from '@/hooks/useProductos'
import { formatGs, formatUsd, normalizar } from '@/lib/format'
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
import type { Producto } from '@/lib/tipos'

/**
 * Un producto dentro de un pedido (a fábrica o de cliente), con su grilla color × tamaño:
 * por cada color, la curva (unidades de cada tamaño en una caja) y sus cajas; la cantidad
 * de cada tamaño es curva × cajas y cada celda con cantidad es una línea del pedido. Los
 * precios valen para todas las líneas. Los números son texto para poder escribir «1,».
 */
export interface GrupoForm {
  clave: string
  productoId: string
  codigo: string
  descripcion: string
  detalle: string
  ejes: EjesGrilla
  cantidades: Record<string, string>
  /** Id de la línea ya guardada de cada celda. */
  ids: Record<string, string>
  /** Cantidad ya comprometida de cada celda (cargada en contenedores o asignada): no se puede bajar de ahí. */
  comprometidos: Record<string, number>
  precioCosto: string
  precioVentaUsd: string
  precioVentaGs: string
  /** Curva de cada color: unidades por caja de cada tamaño (color → id de tamaño → texto). */
  curva: Record<string, Record<string, string>>
  /** Cajas de cada color. */
  cajas: Record<string, string>
}

/** Lo que se necesita de una línea ya guardada para volver a editarla. */
export interface LineaEditable {
  id: string
  productoId: string
  codigo: string
  descripcion: string
  marca: string
  color: string
  tamano: string
  tamanoId: string
  cantidad: number
  porCaja: number
  cajas: number
  /** Ya cargada o asignada: la cantidad no puede quedar por debajo. */
  comprometido: number
  precioCosto?: number
  precioVentaUsd: number
  precioVentaGs: number
}

/** `fabrica` pide el costo; `cliente` pide el precio de venta (USD y Gs). */
export type ModoPrecios = 'fabrica' | 'cliente'

const num = (s: string) => Number(s.replace(',', '.')) || 0
const texto = (n: number | undefined) => (n ? String(n) : '')

const sinVariantes = (e: EjesGrilla) =>
  e.colores.length === 1 && !e.colores[0] && e.tamanos.length === 1 && !e.tamanos[0].id

/** Funciones para armar grupos desde productos y líneas guardadas (usan los catálogos). */
export function useConstructorGrupos() {
  const { nombres: marcas } = useCatalogo('marcas')
  const { nombres: nombreTamano } = useCatalogo('tamanos')
  const { porId } = useProductos()

  const tamanosDe = (p: Producto): TamanoRef[] =>
    p.tamanoIds.map((id) => ({ id, nombre: nombreTamano.get(id) ?? '?' }))

  /** Grupo nuevo de un producto, con la grilla vacía (o 1 unidad si no tiene variantes). */
  function deProducto(p: Producto): GrupoForm {
    const ejes = ejesGrilla(p.colores, tamanosDe(p), [])
    return {
      clave: `n${p.id}${Date.now()}`,
      productoId: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      detalle: marcas.get(p.marcaId) ?? '',
      ejes,
      cantidades: sinVariantes(ejes) ? { [claveCelda('', '')]: '1' } : {},
      ids: {},
      comprometidos: {},
      precioCosto: texto(p.precioCosto),
      precioVentaUsd: texto(p.precioVentaUsd),
      precioVentaGs: texto(p.precioVentaGs),
      curva: {},
      cajas: {},
    }
  }

  /** Arma los grupos de un pedido guardado: una línea = una celda del producto. */
  function deLineas(lineas: LineaEditable[]): GrupoForm[] {
    const porProducto = new Map<string, LineaEditable[]>()
    for (const l of lineas) porProducto.set(l.productoId, [...(porProducto.get(l.productoId) ?? []), l])
    return [...porProducto.entries()].map(([productoId, ls]) => {
      const prod = porId.get(productoId)
      const ejes = ejesGrilla(prod?.colores ?? [], prod ? tamanosDe(prod) : [], ls)
      const g: GrupoForm = {
        clave: productoId,
        productoId,
        codigo: ls[0].codigo,
        descripcion: ls[0].descripcion,
        detalle: ls[0].marca,
        ejes,
        cantidades: {},
        ids: {},
        comprometidos: {},
        precioCosto: texto(ls[0].precioCosto),
        precioVentaUsd: texto(ls[0].precioVentaUsd),
        precioVentaGs: texto(ls[0].precioVentaGs),
        curva: {},
        cajas: {},
      }
      for (const l of ls) {
        const k = claveDeLinea(ejes, l)
        g.cantidades[k] = String(l.cantidad)
        g.ids[k] = l.id
        g.comprometidos[k] = l.comprometido
        // Con curva guardada se recuperan unidades por caja y cajas; si no, la cantidad se muestra como 1 caja.
        const color = k.split('|')[0]
        const conCurva = l.porCaja > 0 && l.cajas > 0
        g.curva[color] = { ...g.curva[color], [l.tamanoId]: String(conCurva ? l.porCaja : l.cantidad) }
        g.cajas[color] = String(conCurva ? l.cajas : 1)
      }
      return g
    })
  }

  return { deProducto, deLineas }
}

/** Convierte los grupos en líneas para guardar, validando cantidades. */
export function lineasDeGrupos(
  grupos: GrupoForm[],
  textoComprometido: string,
): { lineas: DatosLinea[]; error: null } | { lineas: null; error: string } {
  const lineas: DatosLinea[] = []
  for (const g of grupos) {
    let conCantidad = 0
    for (const color of g.ejes.colores) {
      for (const t of g.ejes.tamanos) {
        const k = claveCelda(color, t.id)
        const cantidad = num(g.cantidades[k] ?? '')
        const etiqueta = [g.codigo, color, t.nombre].filter(Boolean).join(' ')
        if (cantidad < 0) return { lineas: null, error: `${etiqueta}: la cantidad no puede ser negativa.` }
        if (cantidad < (g.comprometidos[k] ?? 0)) {
          return { lineas: null, error: `${etiqueta}: ya hay ${g.comprometidos[k]} ${textoComprometido}.` }
        }
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
    if (conCantidad === 0) {
      return { lineas: null, error: `${g.codigo}: indica la cantidad de al menos un tamaño, o quita el producto.` }
    }
  }
  return { lineas, error: null }
}

export function totalesDeGrupos(grupos: GrupoForm[]) {
  return totalesLineas(
    grupos.map((g) => ({
      cantidad: totalGrilla(g.cantidades),
      precioCosto: num(g.precioCosto),
      precioVentaUsd: num(g.precioVentaUsd),
      precioVentaGs: num(g.precioVentaGs),
    })),
  )
}

/** Cantidad de cada tamaño de un color = unidades de su curva × sus cajas (vacío si no hay cajas). */
function conCurva(g: GrupoForm, curva: GrupoForm['curva'], cajas: GrupoForm['cajas'], color: string): GrupoForm {
  const fila = cantidadesDeCurva(g.ejes.tamanos, curva[color] ?? {}, cajas[color] ?? '')
  const cantidades = { ...g.cantidades }
  for (const t of g.ejes.tamanos) cantidades[claveCelda(color, t.id)] = fila?.[t.id] ?? ''
  return { ...g, curva, cajas, cantidades }
}

export function EditorProductos({
  grupos,
  setGrupos,
  proveedorId,
  modo,
  textoComprometido,
}: {
  grupos: GrupoForm[]
  setGrupos: Dispatch<SetStateAction<GrupoForm[]>>
  /** Los productos de esta fábrica se sugieren primero. */
  proveedorId?: string
  modo: ModoPrecios
  /** «cargados en contenedores», «asignados desde pedidos a fábrica»… para el aviso de cada fila. */
  textoComprometido: string
}) {
  const { data: productos, porId } = useProductos()
  const { deProducto } = useConstructorGrupos()
  const [busqueda, setBusqueda] = useState('')

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
    setGrupos((gs) => [...gs, deProducto(p)])
    setBusqueda('')
  }

  const cambiar = (clave: string, parche: Partial<GrupoForm>) =>
    setGrupos((gs) => gs.map((g) => (g.clave === clave ? { ...g, ...parche } : g)))

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

  /**
   * Precios del catálogo que difieren de los del pedido, en una línea ya guardada. Un pedido conserva los
   * precios con que se cargó; el usuario decide si los actualiza (y el cambio queda registrado al guardar).
   */
  function preciosDelCatalogo(g: GrupoForm) {
    const p = porId.get(g.productoId)
    if (!p || Object.keys(g.ids).length === 0) return null
    const cambios: Partial<GrupoForm> = {}
    const textos: string[] = []
    if (modo === 'fabrica') {
      if (p.precioCosto !== num(g.precioCosto)) {
        cambios.precioCosto = texto(p.precioCosto)
        textos.push(`costo ${formatUsd(p.precioCosto)} (en el pedido ${formatUsd(num(g.precioCosto))})`)
      }
    } else {
      if (p.precioVentaUsd !== num(g.precioVentaUsd)) {
        cambios.precioVentaUsd = texto(p.precioVentaUsd)
        textos.push(`venta ${formatUsd(p.precioVentaUsd)} (en el pedido ${formatUsd(num(g.precioVentaUsd))})`)
      }
      if (p.precioVentaGs !== num(g.precioVentaGs)) {
        cambios.precioVentaGs = texto(p.precioVentaGs)
        textos.push(`${formatGs(p.precioVentaGs)} (en el pedido ${formatGs(num(g.precioVentaGs))})`)
      }
    }
    return textos.length ? { cambios, texto: textos.join(' · ') } : null
  }

  return (
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
          Aún no hay productos. Búscalos arriba: al agregar uno aparecen todos sus colores y tamaños para cargar la curva y las cajas.
        </p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const unico = sinVariantes(g.ejes)
            const hayColores = !(g.ejes.colores.length === 1 && !g.ejes.colores[0])
            const bloqueado = Object.values(g.comprometidos).some((n) => n > 0)
            const nuevosPrecios = preciosDelCatalogo(g)
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
                      title={bloqueado ? `Tiene unidades ${textoComprometido}` : 'Quitar producto'}
                      aria-label={`Quitar ${g.codigo}`}
                      disabled={bloqueado}
                      onClick={() => setGrupos((gs) => gs.filter((x) => x.clave !== g.clave))}
                    >
                      <X />
                    </Button>
                  </span>
                </header>

                <div className="space-y-3 p-3">
                  {unico ? (
                    <label className="flex items-center gap-3 text-sm text-foreground">
                      Cantidad
                      <Input
                        inputMode="decimal"
                        aria-label={`Cantidad de ${g.codigo}`}
                        className="h-8 w-28 text-right text-xs"
                        value={g.cantidades[claveCelda('', '')] ?? ''}
                        onChange={(e) => cambiar(g.clave, { cantidades: { ...g.cantidades, [claveCelda('', '')]: e.target.value } })}
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
                              const comprometidoFila = g.ejes.tamanos.reduce(
                                (n, t) => n + (g.comprometidos[claveCelda(color, t.id)] ?? 0),
                                0,
                              )
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
                                      title={comprometidoFila > 0 ? `${comprometidoFila} unidades ya ${textoComprometido}` : undefined}
                                      className={`h-8 w-16 px-1 text-center text-xs ${comprometidoFila > 0 ? 'border-warning' : ''}`}
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

                  {modo === 'fabrica' ? (
                    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                      <Field label="Costo USD (c/u)">
                        <Input
                          inputMode="decimal"
                          className="h-8 text-xs"
                          value={g.precioCosto}
                          onChange={(e) => cambiar(g.clave, { precioCosto: e.target.value })}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
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
                  )}
                  {nuevosPrecios && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                      <span>El catálogo tiene otro precio: {nuevosPrecios.texto}. Este pedido conserva el pactado.</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => cambiar(g.clave, nuevosPrecios.cambios)}>
                        Usar el del catálogo
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Los precios se copian del producto al agregarlo y valen para todos sus colores y tamaños; si luego cambian en el catálogo,
        este pedido no se altera. Si cambias un precio ya guardado, queda registrado el precio original.
      </p>
    </div>
  )
}

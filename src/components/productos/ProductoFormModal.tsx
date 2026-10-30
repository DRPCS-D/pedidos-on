import { Calculator, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Adjuntos } from '@/components/archivos/Adjuntos'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Label, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useConfig } from '@/hooks/useConfig'
import { useProductos, type DatosProducto } from '@/hooks/useProductos'
import { formatGs, formatUsd } from '@/lib/format'
import { calcularPrecio, pasosDe, textoPaso } from '@/lib/precio'
import type { Producto } from '@/lib/tipos'

interface Form {
  codigo: string
  descripcion: string
  marcaId: string
  proveedorId: string
  colores: string[]
  tamanoIds: string[]
  precioCosto: string
  precioVentaUsd: string
  precioVentaGs: string
  tablaPrecioId: string
  activo: boolean
}

const VACIO: Form = {
  codigo: '',
  descripcion: '',
  marcaId: '',
  proveedorId: '',
  colores: [],
  tamanoIds: [],
  precioCosto: '',
  precioVentaUsd: '',
  precioVentaGs: '',
  tablaPrecioId: '',
  activo: true,
}

const num = (s: string) => Number(s.replace(',', '.')) || 0

/** Opciones activas de un catálogo, más la ya elegida aunque esté inactiva (para no perderla al guardar). */
function opciones<T extends { id: string; activo: boolean }>(lista: T[], elegido: string) {
  return lista.filter((x) => x.activo || x.id === elegido)
}

/** Agrega colores de un texto «Rojo, Azul» sin repetir (sin distinguir mayúsculas). */
function sumarColores(actuales: string[], texto: string): string[] {
  const out = [...actuales]
  for (const c of texto.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)) {
    if (!out.some((o) => o.toUpperCase() === c.toUpperCase())) out.push(c)
  }
  return out
}

export function ProductoFormModal({
  abierto,
  producto,
  puedeEditar,
  onCerrar,
  onBorrar,
}: {
  abierto: boolean
  /** null = crear */
  producto: Producto | null
  puedeEditar: boolean
  onCerrar: () => void
  onBorrar: (p: Producto) => void
}) {
  const { data: marcas } = useCatalogo('marcas')
  const { data: tamanos } = useCatalogo('tamanos')
  const { data: proveedores } = useCatalogo('proveedores')
  const { data: tablasPrecio } = useCatalogo('tablasPrecio')
  const { tipoCambio } = useConfig()
  const { guardar, refetch } = useProductos()

  const [f, setF] = useState<Form>(VACIO)
  const [colorNuevo, setColorNuevo] = useState('')
  /** Al crear, el id se conoce recién tras guardar: desde ahí se pueden subir fotos. */
  const [idActual, setIdActual] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setIdActual(producto?.id ?? null)
    setF(
      producto
        ? {
            codigo: producto.codigo,
            descripcion: producto.descripcion,
            marcaId: producto.marcaId,
            proveedorId: producto.proveedorId,
            colores: producto.colores,
            tamanoIds: producto.tamanoIds,
            precioCosto: producto.precioCosto ? String(producto.precioCosto) : '',
            precioVentaUsd: producto.precioVentaUsd ? String(producto.precioVentaUsd) : '',
            precioVentaGs: producto.precioVentaGs ? String(producto.precioVentaGs) : '',
            tablaPrecioId: producto.tablaPrecioId ?? '',
            activo: producto.activo,
          }
        : VACIO,
    )
    setColorNuevo('')
    setError(null)
    // Solo al abrir o cambiar de producto: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, producto?.id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))

  /** Tamaños elegibles agrupados (Calzado, Ropa…), respetando el orden del catálogo. */
  const grupos = useMemo(() => {
    const m = new Map<string, typeof tamanos>()
    for (const t of tamanos) {
      if (!t.activo && !f.tamanoIds.includes(t.id)) continue
      const g = t.grupo || 'Sin grupo'
      m.set(g, [...(m.get(g) ?? []), t])
    }
    return [...m.entries()]
  }, [tamanos, f.tamanoIds])

  const tabla = tablasPrecio.find((t) => t.id === f.tablaPrecioId)
  /** Cálculo de la tabla elegida con el costo escrito (para mostrar el desglose y llenar el precio de venta). */
  const calculo = useMemo(() => (tabla ? calcularPrecio(num(f.precioCosto), pasosDe(tabla)) : null), [tabla, f.precioCosto])

  function agregarColor() {
    if (!colorNuevo.trim()) return
    set('colores', sumarColores(f.colores, colorNuevo))
    setColorNuevo('')
  }

  function alternarTamano(id: string, marcado: boolean) {
    set('tamanoIds', marcado ? [...f.tamanoIds, id] : f.tamanoIds.filter((x) => x !== id))
  }

  function alternarGrupo(ids: string[], marcar: boolean) {
    set('tamanoIds', marcar ? [...new Set([...f.tamanoIds, ...ids])] : f.tamanoIds.filter((x) => !ids.includes(x)))
  }

  async function onGuardar() {
    if (!f.codigo.trim()) return setError('El código es obligatorio.')
    if (!f.descripcion.trim()) return setError('La descripción es obligatoria.')
    // Un color escrito y sin confirmar con Enter también cuenta.
    const colores = colorNuevo.trim() ? sumarColores(f.colores, colorNuevo) : f.colores
    setGuardando(true)
    setError(null)
    const datos: DatosProducto = {
      codigo: f.codigo.trim(),
      descripcion: f.descripcion.trim(),
      marcaId: f.marcaId,
      proveedorId: f.proveedorId,
      colores,
      tamanoIds: f.tamanoIds,
      precioCosto: num(f.precioCosto),
      precioVentaUsd: num(f.precioVentaUsd),
      precioVentaGs: num(f.precioVentaGs),
      tablaPrecioId: f.tablaPrecioId,
      activo: f.activo,
    }
    const { error: err, data } = await guardar(idActual, datos)
    setGuardando(false)
    if (err) return setError(err)
    refetch()
    if (idActual) {
      toast.success('Producto actualizado.')
      onCerrar()
    } else {
      // Se queda abierto para poder agregar las fotos del producto recién creado.
      setColorNuevo('')
      set('colores', colores)
      setIdActual(data?.id ?? null)
      toast.success('Producto creado. Ya puedes agregar fotos.')
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo={producto ? `Producto ${producto.codigo}` : idActual ? 'Producto creado' : 'Nuevo producto'}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      footer={
        puedeEditar ? (
          <>
            {producto && (
              <Button variant="outline" onClick={() => onBorrar(producto)} disabled={guardando}>
                <Trash2 className="text-destructive" /> Borrar
              </Button>
            )}
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              {idActual && !producto ? 'Cerrar' : 'Cancelar'}
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : idActual ? 'Guardar' : 'Crear'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        )
      }
    >
      <fieldset disabled={!puedeEditar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Código (modelo) *">
            <Input value={f.codigo} maxLength={40} autoFocus={!producto} onChange={(e) => set('codigo', e.target.value)} />
          </Field>
          <Field label="Descripción *" className="sm:col-span-2">
            <Input value={f.descripcion} maxLength={300} onChange={(e) => set('descripcion', e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca">
            <Select value={f.marcaId} onChange={(e) => set('marcaId', e.target.value)}>
              <option value="">Sin marca</option>
              {opciones(marcas, f.marcaId).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fábrica habitual" hint="Opcional. Al armar un pedido se sugieren primero sus productos.">
            <Select value={f.proveedorId} onChange={(e) => set('proveedorId', e.target.value)}>
              <option value="">Cualquiera</option>
              {opciones(proveedores, f.proveedorId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <Label>Colores</Label>
          {f.colores.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {f.colores.map((c) => (
                <li key={c} className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-xs text-foreground">
                  {c}
                  <button
                    type="button"
                    aria-label={`Quitar ${c}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => set('colores', f.colores.filter((x) => x !== c))}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            aria-label="Agregar color"
            placeholder="Escribe un color y pulsa Enter (o varios separados por coma)"
            value={colorNuevo}
            maxLength={120}
            onChange={(e) => setColorNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregarColor()
              }
            }}
            onBlur={agregarColor}
          />
          <p className="mt-1 text-xs text-muted-foreground">Sin colores = el producto no tiene variantes de color.</p>
        </div>

        <div>
          <Label>Tamaños en que viene</Label>
          {grupos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Primero crea tamaños en Catálogos.</p>
          ) : (
            <div className="space-y-3 rounded-md border border-input p-3">
              {grupos.map(([grupo, lista]) => {
                const ids = lista.map((t) => t.id)
                const todos = ids.every((id) => f.tamanoIds.includes(id))
                return (
                  <div key={grupo}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-foreground">{grupo}</span>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => alternarGrupo(ids, !todos)}
                      >
                        {todos ? 'Quitar todos' : 'Marcar todos'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lista.map((t) => {
                        const marcado = f.tamanoIds.includes(t.id)
                        return (
                          <label
                            key={t.id}
                            className={`flex cursor-pointer select-none items-center rounded-md border px-2.5 py-1 text-xs transition-colors ${
                              marcado
                                ? 'border-primary bg-primary/10 font-medium text-primary'
                                : 'border-input text-muted-foreground hover:bg-accent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={marcado}
                              onChange={(e) => alternarTamano(t.id, e.target.checked)}
                            />
                            {t.nombre}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Sin tamaños = el producto no tiene tallas (accesorios, por ejemplo).</p>
        </div>

        <Field label="Tabla de precios" hint="Fórmula con la que se calcula el precio de venta en USD a partir del costo.">
          <Select value={f.tablaPrecioId} onChange={(e) => set('tablaPrecioId', e.target.value)}>
            <option value="">Sin tabla (precio manual)</option>
            {opciones(tablasPrecio, f.tablaPrecioId).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Costo (USD)">
            <Input inputMode="decimal" value={f.precioCosto} onChange={(e) => set('precioCosto', e.target.value)} />
          </Field>
          <Field label="Venta (USD)">
            <div className="flex gap-2">
              <Input inputMode="decimal" value={f.precioVentaUsd} onChange={(e) => set('precioVentaUsd', e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={tabla ? `Calcular con la tabla ${tabla.nombre}` : 'Elige una tabla de precios'}
                aria-label="Calcular precio de venta en dólares"
                disabled={!calculo || !num(f.precioCosto)}
                onClick={() => calculo && set('precioVentaUsd', String(calculo.total))}
              >
                <Calculator />
              </Button>
            </div>
          </Field>
          <Field
            label="Venta (Gs)"
            hint={tipoCambio ? `Cotización: ${formatGs(tipoCambio)} por USD` : 'Define el tipo de cambio en Catálogos.'}
          >
            <div className="flex gap-2">
              <Input inputMode="numeric" value={f.precioVentaGs} onChange={(e) => set('precioVentaGs', e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Calcular desde el precio en USD"
                aria-label="Calcular precio en guaraníes"
                disabled={!tipoCambio || !num(f.precioVentaUsd)}
                onClick={() => set('precioVentaGs', String(Math.round(num(f.precioVentaUsd) * tipoCambio)))}
              >
                <Calculator />
              </Button>
            </div>
          </Field>
        </div>
        {calculo && num(f.precioCosto) > 0 && (
          <div className="-mt-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              {tabla?.nombre}: costo {formatUsd(calculo.costo)} → venta {formatUsd(calculo.total)}
              {num(f.precioVentaUsd) !== calculo.total && <span className="ml-2 font-normal text-warning">(el precio de venta escrito es otro)</span>}
            </p>
            <ul className="mt-1">
              {calculo.desglose.map((d, i) => (
                <li key={i}>
                  {d.paso.etiqueta} ({textoPaso(d.paso)}): + {formatUsd(d.monto)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="-mt-2 text-xs text-muted-foreground">Los precios valen para todos los colores y tamaños del producto.</p>

        {idActual && (
          <Field label="Estado">
            <Select value={f.activo ? '1' : '0'} onChange={(e) => set('activo', e.target.value === '1')}>
              <option value="1">Activo</option>
              <option value="0">Inactivo (no se ofrece en pedidos nuevos)</option>
            </Select>
          </Field>
        )}

        {error && <ErrorBox mensaje={error} />}
      </fieldset>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Fotos</h3>
        <Adjuntos entidad="producto" id={idActual} puedeEditar={puedeEditar} />
      </div>
    </Modal>
  )
}

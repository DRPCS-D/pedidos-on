import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { formatUsd } from '@/lib/format'
import { calcularPrecio, pasosDe, textoPaso, type PasoPrecio } from '@/lib/precio'
import type { TablaPrecio } from '@/lib/tipos'

/** Paso tal como se edita: el valor es texto para poder escribir «7,». */
interface PasoForm extends Omit<PasoPrecio, 'valor'> {
  valor: string
}

/** Fórmula habitual para empezar una tabla nueva (se puede cambiar paso por paso). */
const PLANTILLA: PasoForm[] = [
  { etiqueta: 'Gastos de importación', tipo: 'porcentaje', base: 'costo', valor: '50' },
  { etiqueta: 'Margen de ganancia', tipo: 'porcentaje', base: 'acumulado', valor: '38' },
  { etiqueta: 'Royalty', tipo: 'porcentaje', base: 'costo', valor: '7' },
]

const num = (s: string) => Number(s.replace(',', '.')) || 0
const aPasos = (ps: PasoForm[]): PasoPrecio[] => ps.map((p) => ({ ...p, valor: num(p.valor) }))

function TablaPrecioModal({ tabla, onCerrar }: { tabla: TablaPrecio | 'nueva' | null; onCerrar: () => void }) {
  const { guardar, refetch } = useCatalogo('tablasPrecio')
  const [nombre, setNombre] = useState('')
  const [pasos, setPasos] = useState<PasoForm[]>([])
  const [activo, setActivo] = useState(true)
  const [costo, setCosto] = useState('10')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const id = tabla && tabla !== 'nueva' ? tabla.id : null

  useEffect(() => {
    if (!tabla) return
    setNombre(tabla === 'nueva' ? '' : tabla.nombre)
    setPasos(tabla === 'nueva' ? PLANTILLA : pasosDe(tabla).map((p) => ({ ...p, valor: String(p.valor) })))
    setActivo(tabla === 'nueva' ? true : tabla.activo)
    setCosto('10')
    setError(null)
    // Solo al abrir: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla === null, id])

  const cambiar = (i: number, parche: Partial<PasoForm>) => setPasos((ps) => ps.map((p, k) => (k === i ? { ...p, ...parche } : p)))
  const mover = (i: number, d: -1 | 1) =>
    setPasos((ps) => {
      const j = i + d
      if (j < 0 || j >= ps.length) return ps
      const copia = [...ps]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })

  const resultado = calcularPrecio(num(costo), aPasos(pasos))

  async function onGuardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la tabla (por ejemplo «Calzado»).')
    if (pasos.length === 0) return setError('Agrega al menos un paso.')
    if (pasos.some((p) => !p.etiqueta.trim())) return setError('Cada paso necesita un nombre.')
    setGuardando(true)
    setError(null)
    const { error: err } = await guardar(id, {
      nombre: nombre.trim(),
      pasos: JSON.stringify(aPasos(pasos).map((p) => ({ ...p, etiqueta: p.etiqueta.trim() }))),
      activo,
    })
    setGuardando(false)
    if (err) return setError(err)
    toast.success('Tabla de precios guardada.')
    refetch()
    onCerrar()
  }

  return (
    <Modal
      abierto={tabla !== null}
      titulo={id ? 'Editar tabla de precios' : 'Nueva tabla de precios'}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" hint="Por ejemplo: Calzado, Ropa.">
            <Input value={nombre} maxLength={60} autoFocus onChange={(e) => setNombre(e.target.value)} />
          </Field>
          {id && (
            <Field label="Estado">
              <Select value={activo ? '1' : '0'} onChange={(e) => setActivo(e.target.value === '1')}>
                <option value="1">Activa</option>
                <option value="0">Inactiva (no se ofrece en productos nuevos)</option>
              </Select>
            </Field>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Pasos del cálculo</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Se parte del costo en USD y cada paso suma un porcentaje o un monto fijo. Un porcentaje puede ser sobre el costo original o
            sobre lo acumulado hasta el paso anterior. El resultado es el precio de venta en USD.
          </p>
          <div className="space-y-2">
            {pasos.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-md border border-border p-2 sm:grid-cols-[1.3fr_11rem_10rem_5.5rem_auto]">
                <Field label={i === 0 ? 'Nombre del paso' : ''} className="col-span-2 sm:col-span-1">
                  <Input aria-label="Nombre del paso" value={p.etiqueta} maxLength={60} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} />
                </Field>
                <Field label={i === 0 ? 'Suma' : ''}>
                  <Select aria-label="Tipo de paso" value={p.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as PasoForm['tipo'] })}>
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="monto">Monto fijo (USD)</option>
                  </Select>
                </Field>
                <Field label={i === 0 ? 'Calculado sobre' : ''}>
                  <Select
                    aria-label="Base del porcentaje"
                    value={p.base}
                    disabled={p.tipo === 'monto'}
                    onChange={(e) => cambiar(i, { base: e.target.value as PasoForm['base'] })}
                  >
                    <option value="costo">El costo</option>
                    <option value="acumulado">Lo acumulado</option>
                  </Select>
                </Field>
                <Field label={i === 0 ? 'Valor' : ''}>
                  <Input aria-label="Valor" inputMode="decimal" value={p.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} />
                </Field>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Subir paso" disabled={i === 0} onClick={() => mover(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Bajar paso" disabled={i === pasos.length - 1} onClick={() => mover(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Quitar paso" onClick={() => setPasos((ps) => ps.filter((_, k) => k !== i))}>
                    <X />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {pasos.length < 12 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setPasos((ps) => [...ps, { etiqueta: '', tipo: 'porcentaje', base: 'costo', valor: '' }])}
            >
              <Plus /> Agregar paso
            </Button>
          )}
        </div>

        <div className="rounded-md bg-secondary/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Prueba</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Costo USD
              <Input aria-label="Costo de ejemplo" inputMode="decimal" className="h-8 w-24 text-right" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </label>
          </div>
          <dl className="tabular space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Costo</dt>
              <dd>{formatUsd(resultado.costo)}</dd>
            </div>
            {resultado.desglose.map((d, i) => (
              <div key={i} className="flex justify-between gap-4 text-muted-foreground">
                <dt>
                  {d.paso.etiqueta || 'Paso sin nombre'} <span className="text-xs">({textoPaso(d.paso)})</span>
                </dt>
                <dd>+ {formatUsd(d.monto)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-1 font-medium text-foreground">
              <dt>Precio de venta USD</dt>
              <dd>{formatUsd(resultado.total)}</dd>
            </div>
          </dl>
        </div>

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

/** Tablas de precio: fórmulas para calcular el precio de venta en USD de un producto a partir de su costo. */
export function TablasPrecio() {
  const { esAdmin } = useAuth()
  const { data, loading, borrar, refetch } = useCatalogo('tablasPrecio')
  const [editando, setEditando] = useState<TablaPrecio | 'nueva' | null>(null)
  const [borrando, setBorrando] = useState<TablaPrecio | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function onBorrar() {
    if (!borrando) return
    setProcesando(true)
    const { error } = await borrar(borrando.id)
    setProcesando(false)
    if (error) return toast.error(error)
    toast.success('Tabla borrada.')
    refetch()
    setBorrando(null)
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tablas de precio</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Cada tabla es una fórmula que calcula el precio de venta en USD a partir del costo (por ejemplo: costo + 50% de gastos de
            importación + 38% de margen + 7% de royalty). Cada producto elige su tabla y usa el botón «Calcular». Los pedidos ya cargados
            no cambian.
          </p>
        </div>
        {esAdmin && (
          <Button size="sm" onClick={() => setEditando('nueva')}>
            <Plus /> Nueva tabla
          </Button>
        )}
      </div>

      {data.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{loading ? 'Cargando…' : 'Todavía no hay tablas de precio.'}</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.map((t) => {
            const pasos = pasosDe(t)
            const r = calcularPrecio(10, pasos)
            return (
              <article key={t.id} className={`rounded-md border border-border p-4 ${t.activo ? '' : 'opacity-60'}`}>
                <header className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t.nombre}
                    {!t.activo && <span className="ml-2 text-xs font-normal text-muted-foreground">inactiva</span>}
                  </h3>
                  {esAdmin && (
                    <span className="flex">
                      <Button variant="ghost" size="icon" className="size-7" aria-label={`Editar ${t.nombre}`} onClick={() => setEditando(t)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" aria-label={`Borrar ${t.nombre}`} onClick={() => setBorrando(t)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </span>
                  )}
                </header>
                <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {pasos.map((p, i) => (
                    <li key={i}>
                      {i + 1}. {p.etiqueta}: {textoPaso(p)}
                    </li>
                  ))}
                </ol>
                <p className="tabular mt-2 text-xs text-foreground">Costo {formatUsd(10)} → venta {formatUsd(r.total)}</p>
              </article>
            )
          })}
        </div>
      )}
      {!esAdmin && <p className="mt-3 text-xs text-muted-foreground">Solo un admin puede crear o cambiar las tablas.</p>}

      <TablaPrecioModal tabla={editando} onCerrar={() => setEditando(null)} />
      <ConfirmModal
        abierto={borrando !== null}
        titulo="Borrar tabla de precios"
        textoConfirmar="Borrar"
        procesando={procesando}
        mensaje={
          <>
            Se borrará la tabla <strong>{borrando?.nombre}</strong>. Si algún producto la usa, desactívala en lugar de borrarla.
          </>
        }
        onCancelar={() => setBorrando(null)}
        onConfirmar={onBorrar}
      />
    </section>
  )
}

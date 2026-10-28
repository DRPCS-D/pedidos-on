import { Calculator, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Adjuntos } from '@/components/archivos/Adjuntos'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useConfig } from '@/hooks/useConfig'
import { useProductos, type DatosProducto } from '@/hooks/useProductos'
import { formatGs } from '@/lib/format'
import type { Producto } from '@/lib/tipos'

interface Form {
  codigo: string
  descripcion: string
  color: string
  marcaId: string
  tamanoId: string
  proveedorId: string
  precioCosto: string
  precioVentaUsd: string
  precioVentaGs: string
  activo: boolean
}

const VACIO: Form = {
  codigo: '',
  descripcion: '',
  color: '',
  marcaId: '',
  tamanoId: '',
  proveedorId: '',
  precioCosto: '',
  precioVentaUsd: '',
  precioVentaGs: '',
  activo: true,
}

const num = (s: string) => Number(s.replace(',', '.')) || 0

/** Opciones activas de un catálogo, más la ya elegida aunque esté inactiva (para no perderla al guardar). */
function opciones<T extends { id: string; activo: boolean }>(lista: T[], elegido: string) {
  return lista.filter((x) => x.activo || x.id === elegido)
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
  const { tipoCambio } = useConfig()
  const { guardar, refetch } = useProductos()

  const [f, setF] = useState<Form>(VACIO)
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
            color: producto.color,
            marcaId: producto.marcaId,
            tamanoId: producto.tamanoId,
            proveedorId: producto.proveedorId,
            precioCosto: producto.precioCosto ? String(producto.precioCosto) : '',
            precioVentaUsd: producto.precioVentaUsd ? String(producto.precioVentaUsd) : '',
            precioVentaGs: producto.precioVentaGs ? String(producto.precioVentaGs) : '',
            activo: producto.activo,
          }
        : VACIO,
    )
    setError(null)
    // Solo al abrir o cambiar de producto: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, producto?.id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))

  async function onGuardar() {
    if (!f.codigo.trim()) return setError('El código es obligatorio.')
    if (!f.descripcion.trim()) return setError('La descripción es obligatoria.')
    setGuardando(true)
    setError(null)
    const datos: DatosProducto = {
      codigo: f.codigo.trim(),
      descripcion: f.descripcion.trim(),
      color: f.color.trim(),
      marcaId: f.marcaId,
      tamanoId: f.tamanoId,
      proveedorId: f.proveedorId,
      precioCosto: num(f.precioCosto),
      precioVentaUsd: num(f.precioVentaUsd),
      precioVentaGs: num(f.precioVentaGs),
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
          <Field label="Código *">
            <Input value={f.codigo} maxLength={40} autoFocus={!producto} onChange={(e) => set('codigo', e.target.value)} />
          </Field>
          <Field label="Descripción *" className="sm:col-span-2">
            <Input value={f.descripcion} maxLength={300} onChange={(e) => set('descripcion', e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color">
            <Input value={f.color} maxLength={60} onChange={(e) => set('color', e.target.value)} />
          </Field>
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
          <Field label="Tamaño">
            <Select value={f.tamanoId} onChange={(e) => set('tamanoId', e.target.value)}>
              <option value="">Sin tamaño</option>
              {opciones(tamanos, f.tamanoId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Costo (USD)">
            <Input inputMode="decimal" value={f.precioCosto} onChange={(e) => set('precioCosto', e.target.value)} />
          </Field>
          <Field label="Venta (USD)">
            <Input inputMode="decimal" value={f.precioVentaUsd} onChange={(e) => set('precioVentaUsd', e.target.value)} />
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

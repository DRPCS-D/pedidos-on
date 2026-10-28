import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useContenedores, type DatosContenedor } from '@/hooks/useContenedores'
import { TIPO_CONTENEDOR_LABEL, type Contenedor, type TipoContenedor } from '@/lib/tipos'

const VACIO: DatosContenedor = {
  numero: '',
  tipo: '40HC',
  naviera: '',
  bl: '',
  puertoOrigen: '',
  puertoDestino: '',
  etd: '',
  eta: '',
  notas: '',
}

export function ContenedorFormModal({
  abierto,
  contenedor,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  /** null = crear */
  contenedor: Contenedor | null
  onCerrar: () => void
  /** Recibe el id del contenedor guardado. */
  onGuardado: (id: string) => void
}) {
  const { guardar, refetch } = useContenedores()
  const [f, setF] = useState<DatosContenedor>(VACIO)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setF(
      contenedor
        ? {
            numero: contenedor.numero,
            tipo: contenedor.tipo,
            naviera: contenedor.naviera,
            bl: contenedor.bl,
            puertoOrigen: contenedor.puertoOrigen,
            puertoDestino: contenedor.puertoDestino,
            etd: contenedor.etd,
            eta: contenedor.eta,
            notas: contenedor.notas,
          }
        : VACIO,
    )
    setError(null)
    // Solo al abrir o cambiar de contenedor: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, contenedor?.id])

  const set = <K extends keyof DatosContenedor>(k: K, v: DatosContenedor[K]) => setF((x) => ({ ...x, [k]: v }))

  async function onGuardar() {
    if (!f.numero.trim()) return setError('El número o referencia del contenedor es obligatorio.')
    if (f.etd && f.eta && f.eta < f.etd) return setError('La llegada estimada no puede ser anterior a la salida.')
    setGuardando(true)
    setError(null)
    const { error: err, data } = await guardar(contenedor?.id ?? null, { ...f, numero: f.numero.trim() })
    setGuardando(false)
    if (err || !data) return setError(err ?? 'No se pudo guardar el contenedor.')
    toast.success(contenedor ? 'Contenedor actualizado.' : 'Contenedor creado.')
    refetch()
    onGuardado(data.id)
  }

  return (
    <Modal
      abierto={abierto}
      titulo={contenedor ? `Editar ${contenedor.numero}` : 'Nuevo contenedor'}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : contenedor ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número / referencia *" hint="Ej. MSKU1234567. Si aún no lo tienes, pon una referencia.">
            <Input value={f.numero} maxLength={30} autoFocus={!contenedor} onChange={(e) => set('numero', e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoContenedor)}>
              {(Object.keys(TIPO_CONTENEDOR_LABEL) as TipoContenedor[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_CONTENEDOR_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Naviera">
            <Input value={f.naviera} maxLength={60} onChange={(e) => set('naviera', e.target.value)} />
          </Field>
          <Field label="BL (conocimiento de embarque)">
            <Input value={f.bl} maxLength={60} onChange={(e) => set('bl', e.target.value)} />
          </Field>
          <Field label="Puerto de origen">
            <Input value={f.puertoOrigen} maxLength={60} onChange={(e) => set('puertoOrigen', e.target.value)} />
          </Field>
          <Field label="Puerto de destino">
            <Input value={f.puertoDestino} maxLength={60} onChange={(e) => set('puertoDestino', e.target.value)} />
          </Field>
          <Field label="Salida estimada (ETD)">
            <Input type="date" value={f.etd} onChange={(e) => set('etd', e.target.value)} />
          </Field>
          <Field label="Llegada estimada (ETA)">
            <Input type="date" value={f.eta} onChange={(e) => set('eta', e.target.value)} />
          </Field>
        </div>
        <Field label="Notas">
          <Textarea value={f.notas} maxLength={2000} onChange={(e) => set('notas', e.target.value)} />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

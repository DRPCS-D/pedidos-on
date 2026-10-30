import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useConfig } from '@/hooks/useConfig'
import { ejecutarConDatos } from '@/lib/ejecutar'
import { formatFecha, hoyIso } from '@/lib/format'
import { aDia, aniosSinPausa, pausasDe, proyectar, proyectarInverso } from '@/lib/proyeccion'
import type { ProyeccionGuardada } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { textoDiasHasta } from './textos'

type Modo = ProyeccionGuardada['modo']

const OPCIONES: { modo: Modo; titulo: string; descripcion: string }[] = [
  { modo: 'inicio', titulo: 'Tengo la fecha de inicio', descripcion: 'Calcula cuándo termina y cuándo llega.' },
  { modo: 'final', titulo: 'Tengo la fecha final', descripcion: 'Calcula hasta cuándo se puede hacer el pedido.' },
]

/**
 * Alta y edición de una proyección. Se indica una sola fecha: la de inicio de la fabricación (se calcula hacia
 * adelante) o la fecha en que el cliente quiere recibir (se calcula hacia atrás, hasta cuándo puede hacer el pedido).
 * Los plazos y las pausas son los de la configuración; al editar se conservan los que tenía guardados.
 */
export function ProyeccionFormModal({
  proyeccion,
  onCerrar,
  onGuardada,
}: {
  proyeccion: ProyeccionGuardada | 'nueva' | null
  onCerrar: () => void
  onGuardada: (id: string) => void
}) {
  const { plazos } = useConfig()
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [modo, setModo] = useState<Modo>('inicio')
  const [fecha, setFecha] = useState('')
  const [fab, setFab] = useState('')
  const [tra, setTra] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const id = proyeccion && proyeccion !== 'nueva' ? proyeccion.id : null

  useEffect(() => {
    if (!proyeccion) return
    const g = proyeccion === 'nueva' ? null : proyeccion
    setNombre(g?.nombre ?? '')
    setNotas(g?.notas ?? '')
    setModo(g?.modo ?? 'inicio')
    setFecha(g?.fechaBase ?? '')
    setFab(g?.diasFabricacion ?? '')
    setTra(g?.diasTransito ?? '')
    setError(null)
    // Solo al abrir: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyeccion === null, id])

  const guardada = proyeccion && proyeccion !== 'nueva' ? proyeccion : null
  // Al editar se ajustan los plazos de esta proyección; una nueva parte de los de la configuración.
  const diasFab = guardada ? Number(fab) : plazos.diasFabricacion
  const diasTra = guardada ? Number(tra) : plazos.diasTransito
  const pausas = guardada ? pausasDe(guardada.pausas) : plazos.pausas

  const plazosValidos = !guardada || (diasFab >= 1 && tra !== '')
  const proy = fecha && plazosValidos
    ? modo === 'inicio'
      ? proyectar(fecha, diasFab, diasTra, pausas)
      : proyectarInverso(fecha, diasFab, diasTra, pausas)
    : null
  const sinPausa = proy ? aniosSinPausa(proy.inicio, proy.finFabricacion, pausas) : []
  const antes = modo === 'final' && proy && aDia(fecha) !== null ? aDia(fecha)! - aDia(proy.llegada)! : 0

  async function onGuardar() {
    if (!nombre.trim()) return setError('Ponle un nombre (por ejemplo «Cliente X, calzado»).')
    if (!fecha) return setError(modo === 'inicio' ? 'Indica la fecha de inicio.' : 'Indica la fecha final.')
    if (guardada && !(diasFab >= 1)) return setError('Indica los días de fabricación (al menos 1).')
    if (guardada && tra === '') return setError('Indica los días de transporte.')
    if (!proy) return setError('La fecha no es válida.')
    setGuardando(true)
    setError(null)
    const { error: err, data } = await ejecutarConDatos<{ id: string }>(
      'guardarCatalogo',
      {
        tabla: 'proyecciones',
        id: id ?? '',
        datos: {
          nombre: nombre.trim(),
          notas: notas.trim(),
          modo,
          fechaBase: fecha,
          inicio: proy.inicio,
          diasFabricacion: String(diasFab),
          diasTransito: String(diasTra),
          pausas: JSON.stringify(pausas),
          finFabricacion: proy.finFabricacion,
          llegada: proy.llegada,
        },
      },
      'No se pudo guardar la proyección.',
    )
    setGuardando(false)
    if (err || !data) return setError(err ?? 'No se pudo guardar la proyección.')
    toast.success(id ? 'Proyección actualizada.' : 'Proyección creada.')
    onGuardada(data.id)
  }

  return (
    <Modal
      abierto={proyeccion !== null}
      titulo={id ? 'Editar proyección' : 'Nueva proyección'}
      onCerrar={onCerrar}
      ancho="max-w-xl"
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
          <Field label="Nombre *">
            <Input value={nombre} maxLength={80} autoFocus placeholder="Cliente X, calzado" onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Notas">
            <Input value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">¿Qué fecha tienes?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OPCIONES.map((o) => (
              <button
                key={o.modo}
                type="button"
                aria-pressed={modo === o.modo}
                onClick={() => setModo(o.modo)}
                className={cn(
                  'rounded-md border p-3 text-left transition-colors',
                  modo === o.modo ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50',
                )}
              >
                <span className="block text-sm font-medium text-foreground">{o.titulo}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.descripcion}</span>
              </button>
            ))}
          </div>
        </div>

        <Field
          label={modo === 'inicio' ? 'Fecha de inicio de la fabricación *' : 'Fecha final: cuándo quiere recibir el cliente *'}
          hint={modo === 'final' ? 'Llegada al depósito de la empresa.' : undefined}
        >
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>

        {guardada && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Días de fabricación" hint="Sin contar las pausas. Solo cambia esta proyección.">
              <Input inputMode="numeric" value={fab} onChange={(e) => setFab(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Días de transporte" hint="No lo frenan las pausas.">
              <Input inputMode="numeric" value={tra} onChange={(e) => setTra(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {!guardada && `Se usan ${diasFab} días de fabricación (sin contar las pausas) y ${diasTra} de transporte; se pueden ajustar al editarla. `}
          {pausas.length > 0
            ? ` Pausas: ${pausas.map((p) => `${p.anio} (${formatFecha(p.desde)} al ${formatFecha(p.hasta)})`).join(', ')}.`
            : ' No hay pausas cargadas.'}
        </p>

        {fecha && !proy && <ErrorBox mensaje="La fecha no es válida." />}

        {proy && (
          <div className="rounded-md bg-secondary/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Resultado</h3>
            <dl className="tabular space-y-1 text-sm">
              {modo === 'final' ? (
                <>
                  <div className="flex justify-between gap-4 font-medium text-foreground">
                    <dt>Fecha límite para hacer el pedido</dt>
                    <dd>{formatFecha(proy.inicio)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <dt>Termina de fabricar</dt>
                    <dd>{formatFecha(proy.finFabricacion)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <dt>Llega al depósito</dt>
                    <dd>{formatFecha(proy.llegada)}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <dt>Termina de fabricar</dt>
                    <dd>{formatFecha(proy.finFabricacion)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 font-medium text-foreground">
                    <dt>Llega al depósito</dt>
                    <dd>{formatFecha(proy.llegada)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>Días de pausa en la fabricación</dt>
                <dd>{proy.diasPausa}</dd>
              </div>
            </dl>
            {modo === 'final' && <p className="mt-2 text-xs text-muted-foreground">{textoDiasHasta(proy.inicio, hoyIso(), 'límite')}</p>}
            {antes > 0 && (
              <p className="mt-1 text-xs text-warning">
                La fabricación terminaría justo en una pausa, así que llegaría {antes} {antes === 1 ? 'día' : 'días'} antes de la fecha pedida.
              </p>
            )}
          </div>
        )}

        {sinPausa.length > 0 && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            Falta cargar la pausa de la fábrica de {sinPausa.join(' y ')}. Sin ella el cálculo no la descuenta. Un admin la agrega en Configuración.
          </p>
        )}

        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

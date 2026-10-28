import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { hoyIso } from '@/lib/format'

export interface OpcionEstado {
  valor: string
  label: string
}

/**
 * Cambio de estado de un pedido o contenedor, con la fecha en que ocurrió
 * (por defecto hoy, no futura) y una nota opcional.
 */
export function CambiarEstadoModal({
  abierto,
  titulo,
  descripcion,
  opciones,
  inicial,
  onCerrar,
  onConfirmar,
  onHecho,
}: {
  abierto: boolean
  titulo: string
  descripcion?: string
  opciones: OpcionEstado[]
  /** Estado preseleccionado. */
  inicial?: string
  onCerrar: () => void
  onConfirmar: (estado: string, fecha: string, nota: string) => Promise<{ error: string | null }>
  onHecho: () => void
}) {
  const [estado, setEstado] = useState('')
  const [fecha, setFecha] = useState(hoyIso())
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // `opciones` llega como arreglo nuevo en cada render del padre: se compara por contenido
  // para no borrar lo que el usuario va escribiendo.
  const claveOpciones = opciones.map((o) => o.valor).join('|')
  useEffect(() => {
    if (!abierto) return
    const valores = claveOpciones ? claveOpciones.split('|') : []
    setEstado(inicial && valores.includes(inicial) ? inicial : (valores[0] ?? ''))
    setFecha(hoyIso())
    setNota('')
    setError(null)
  }, [abierto, inicial, claveOpciones])

  async function onGuardar() {
    if (!estado) return setError('Elige el nuevo estado.')
    if (!fecha) return setError('Indica la fecha del cambio.')
    setGuardando(true)
    setError(null)
    const { error: err } = await onConfirmar(estado, fecha, nota.trim())
    setGuardando(false)
    if (err) return setError(err)
    toast.success('Estado actualizado.')
    onHecho()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      descripcion={descripcion}
      onCerrar={onCerrar}
      ancho="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando || opciones.length === 0}>
            {guardando ? 'Guardando…' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {opciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay estados disponibles desde aquí.</p>
        ) : (
          <>
            <Field label="Nuevo estado">
              <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
                {opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha en que ocurrió" hint="Puedes poner una fecha pasada si lo estás registrando tarde.">
              <Input type="date" value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field label="Nota (opcional)">
              <Input value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} />
            </Field>
          </>
        )}
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

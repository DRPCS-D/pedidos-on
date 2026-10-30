import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/hooks/useConfig'
import { aDia } from '@/lib/proyeccion'

/** Pausa tal como se edita: el año es texto para poder escribirlo. */
interface PausaForm {
  anio: string
  desde: string
  hasta: string
}

/** Plazos de fabricación y transporte, y pausas de la fábrica (Año Nuevo Chino), que usa la proyección de entrega. */
export function PlazosPausas() {
  const { esAdmin } = useAuth()
  const { plazos, loading, guardarPlazo, refetch } = useConfig()
  const [fab, setFab] = useState('')
  const [tra, setTra] = useState('')
  const [pausas, setPausas] = useState<PausaForm[]>([])
  const [guardando, setGuardando] = useState(false)

  // Se rellena al llegar la configuración y cuando cambia desde afuera.
  const textoPausas = JSON.stringify(plazos.pausas)
  useEffect(() => {
    setFab(String(plazos.diasFabricacion))
    setTra(String(plazos.diasTransito))
    setPausas((JSON.parse(textoPausas) as { anio: number; desde: string; hasta: string }[]).map((p) => ({ ...p, anio: String(p.anio) })))
  }, [plazos.diasFabricacion, plazos.diasTransito, textoPausas])

  const cambiar = (i: number, parche: Partial<PausaForm>) => setPausas((ps) => ps.map((p, k) => (k === i ? { ...p, ...parche } : p)))

  async function onGuardar() {
    const f = Number(fab)
    const t = Number(tra)
    if (!(f >= 1)) return toast.error('Los días de fabricación deben ser al menos 1.')
    if (!(t >= 0) || tra === '') return toast.error('Escribe los días de transporte.')
    const anios = new Set<string>()
    for (const p of pausas) {
      if (!/^\d{4}$/.test(p.anio)) return toast.error('Escribe el año de cada pausa (por ejemplo 2027).')
      if (anios.has(p.anio)) return toast.error(`Hay dos pausas del año ${p.anio}. Cada año tiene una sola.`)
      anios.add(p.anio)
      const a = aDia(p.desde)
      const b = aDia(p.hasta)
      if (a === null || b === null) return toast.error(`Completa las dos fechas de la pausa de ${p.anio}.`)
      if (a > b) return toast.error(`La pausa de ${p.anio} termina antes de empezar.`)
    }
    setGuardando(true)
    const a = await guardarPlazo('plazoFabricacion', f)
    const b = a.error ? a : await guardarPlazo('plazoTransito', t)
    const ordenadas = pausas.map((p) => ({ anio: Number(p.anio), desde: p.desde, hasta: p.hasta })).sort((x, y) => x.anio - y.anio)
    const c = b.error ? b : await guardarPlazo('pausas', JSON.stringify(ordenadas))
    setGuardando(false)
    if (c.error) toast.error(c.error)
    else {
      toast.success('Plazos y pausas actualizados.')
      refetch()
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5 shadow-xs">
      <h2 className="text-sm font-semibold text-foreground">Plazos y pausas de la fábrica</h2>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Valores de partida de la proyección de entrega. En las pausas la fábrica no produce (Año Nuevo Chino): la fabricación se detiene y
        sigue después. El transporte no se detiene por ninguna pausa.
      </p>
      <div className="mt-3 grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label="Días de fabricación">
          <Input inputMode="numeric" value={fab} disabled={!esAdmin || loading} onChange={(e) => setFab(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Días de transporte">
          <Input inputMode="numeric" value={tra} disabled={!esAdmin || loading} onChange={(e) => setTra(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>

      <div className="mt-4 max-w-xl space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Pausa de cada año</p>
        <p className="text-xs text-muted-foreground">
          La fecha del Año Nuevo Chino cambia cada año, así que cada año tiene su propia pausa. Si un año no tiene pausa cargada, la
          proyección no la descuenta y lo avisa.
        </p>
        {pausas.length === 0 && <p className="text-xs text-muted-foreground">No hay pausas cargadas.</p>}
        {pausas.map((p, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label={i === 0 ? 'Año' : ''} className="w-24">
              <Input
                inputMode="numeric"
                maxLength={4}
                aria-label="Año"
                value={p.anio}
                disabled={!esAdmin}
                onChange={(e) => cambiar(i, { anio: e.target.value.replace(/\D/g, '') })}
              />
            </Field>
            <Field label={i === 0 ? 'Desde' : ''} className="flex-1">
              <Input type="date" aria-label="Desde" value={p.desde} disabled={!esAdmin} onChange={(e) => cambiar(i, { desde: e.target.value })} />
            </Field>
            <Field label={i === 0 ? 'Hasta (incluido)' : ''} className="flex-1">
              <Input type="date" aria-label="Hasta" value={p.hasta} disabled={!esAdmin} onChange={(e) => cambiar(i, { hasta: e.target.value })} />
            </Field>
            {esAdmin && (
              <Button variant="ghost" size="icon" className="size-9" aria-label={`Quitar la pausa de ${p.anio}`} onClick={() => setPausas((ps) => ps.filter((_, k) => k !== i))}>
                <X />
              </Button>
            )}
          </div>
        ))}
        {esAdmin && pausas.length < 40 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPausas((ps) => {
                const ultimo = Math.max(0, ...ps.map((p) => Number(p.anio) || 0))
                return [...ps, { anio: String(ultimo ? ultimo + 1 : new Date().getFullYear() + 1), desde: '', hasta: '' }]
              })
            }
          >
            <Plus /> Agregar año
          </Button>
        )}
      </div>

      {esAdmin ? (
        <Button className="mt-4" onClick={onGuardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar plazos y pausas'}
        </Button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Solo un admin puede cambiarlos.</p>
      )}
    </section>
  )
}

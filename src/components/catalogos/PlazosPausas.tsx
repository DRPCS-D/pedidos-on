import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/hooks/useConfig'
import { aDia } from '@/lib/proyeccion'

interface PausaForm {
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
    setPausas(JSON.parse(textoPausas) as PausaForm[])
  }, [plazos.diasFabricacion, plazos.diasTransito, textoPausas])

  const cambiar = (i: number, parche: Partial<PausaForm>) => setPausas((ps) => ps.map((p, k) => (k === i ? { ...p, ...parche } : p)))

  async function onGuardar() {
    const f = Number(fab)
    const t = Number(tra)
    if (!(f >= 1)) return toast.error('Los días de fabricación deben ser al menos 1.')
    if (!(t >= 0) || tra === '') return toast.error('Escribe los días de transporte.')
    for (const p of pausas) {
      const a = aDia(p.desde)
      const b = aDia(p.hasta)
      if (a === null || b === null) return toast.error('Completa las dos fechas de cada pausa.')
      if (a > b) return toast.error('Una pausa termina antes de empezar.')
    }
    setGuardando(true)
    const a = await guardarPlazo('plazoFabricacion', f)
    const b = a.error ? a : await guardarPlazo('plazoTransito', t)
    const c = b.error ? b : await guardarPlazo('pausas', JSON.stringify(pausas))
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
        <p className="text-xs font-medium text-muted-foreground">Pausas</p>
        {pausas.length === 0 && <p className="text-xs text-muted-foreground">No hay pausas cargadas.</p>}
        {pausas.map((p, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label={i === 0 ? 'Desde' : ''} className="flex-1">
              <Input type="date" aria-label="Desde" value={p.desde} disabled={!esAdmin} onChange={(e) => cambiar(i, { desde: e.target.value })} />
            </Field>
            <Field label={i === 0 ? 'Hasta (incluido)' : ''} className="flex-1">
              <Input type="date" aria-label="Hasta" value={p.hasta} disabled={!esAdmin} onChange={(e) => cambiar(i, { hasta: e.target.value })} />
            </Field>
            {esAdmin && (
              <Button variant="ghost" size="icon" className="size-9" aria-label="Quitar pausa" onClick={() => setPausas((ps) => ps.filter((_, k) => k !== i))}>
                <X />
              </Button>
            )}
          </div>
        ))}
        {esAdmin && pausas.length < 40 && (
          <Button variant="outline" size="sm" onClick={() => setPausas((ps) => [...ps, { desde: '', hasta: '' }])}>
            <Plus /> Agregar pausa
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

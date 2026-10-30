import { FolderOpen, Printer, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarioProyeccion } from '@/components/proyeccion/CalendarioProyeccion'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useConfig } from '@/hooks/useConfig'
import { formatFecha, hoyIso } from '@/lib/format'
import { aDia, pausasDe, proyectar, type Pausa } from '@/lib/proyeccion'
import type { ProyeccionGuardada } from '@/lib/tipos'

const clavePausa = (p: Pausa) => `${p.desde}|${p.hasta}`

function Dato({ etiqueta, valor, nota, resaltar }: { etiqueta: string; valor: string; nota?: string; resaltar?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${resaltar ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-card'}`}>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-foreground">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  )
}

/** Diferencia entre dos llegadas, en palabras. */
function textoDiferencia(dias: number): string {
  if (dias === 0) return 'llega el mismo día'
  const n = Math.abs(dias)
  return `llega ${n} ${n === 1 ? 'día' : 'días'} ${dias < 0 ? 'antes' : 'después'}`
}

export default function Proyeccion() {
  const { puedeEditar } = useAuth()
  const { plazos } = useConfig()
  const { data: guardadas, loading, error, guardar, borrar, refetch } = useCatalogo('proyecciones')

  const [inicio, setInicio] = useState(hoyIso())
  // Mientras no se toquen, los plazos y las pausas son los de la configuración.
  const [fab, setFab] = useState<string | null>(null)
  const [tra, setTra] = useState<string | null>(null)
  const [pausasPropias, setPausasPropias] = useState<Pausa[] | null>(null)
  const [apagadas, setApagadas] = useState<string[]>([])
  const [comparar, setComparar] = useState('')
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [idCargado, setIdCargado] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<ProyeccionGuardada | null>(null)
  const [procesando, setProcesando] = useState(false)

  const diasFab = Number(fab ?? plazos.diasFabricacion)
  const diasTra = Number(tra ?? plazos.diasTransito)
  const pausasDisponibles = pausasPropias ?? plazos.pausas
  const pausas = pausasDisponibles.filter((p) => !apagadas.includes(clavePausa(p)))

  const proy = proyectar(inicio, diasFab, diasTra, pausas)
  const otra = comparar ? proyectar(comparar, diasFab, diasTra, pausas) : null

  function nueva() {
    setFab(null)
    setTra(null)
    setPausasPropias(null)
    setApagadas([])
    setComparar('')
    setNombre('')
    setNotas('')
    setIdCargado(null)
  }

  function cargar(g: ProyeccionGuardada) {
    setInicio(g.inicio)
    setFab(g.diasFabricacion)
    setTra(g.diasTransito)
    setPausasPropias(pausasDe(g.pausas))
    setApagadas([])
    setComparar('')
    setNombre(g.nombre)
    setNotas(g.notas)
    setIdCargado(g.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onGuardar() {
    if (!proy) return
    if (!nombre.trim()) return toast.error('Ponle un nombre a la proyección (por ejemplo «Cliente X, calzado»).')
    setGuardando(true)
    const { error: err } = await guardar(idCargado, {
      nombre: nombre.trim(),
      inicio,
      diasFabricacion: String(diasFab),
      diasTransito: String(diasTra),
      pausas: JSON.stringify(pausas),
      finFabricacion: proy.finFabricacion,
      llegada: proy.llegada,
      notas: notas.trim(),
    })
    setGuardando(false)
    if (err) return toast.error(err)
    toast.success(idCargado ? 'Proyección actualizada.' : 'Proyección guardada.')
    refetch()
    if (!idCargado) nueva()
  }

  async function onBorrar() {
    if (!borrando) return
    setProcesando(true)
    const { error: err } = await borrar(borrando.id)
    setProcesando(false)
    if (err) return toast.error(err)
    toast.success('Proyección borrada.')
    if (borrando.id === idCargado) setIdCargado(null)
    refetch()
    setBorrando(null)
  }

  const meses = proy ? proy.diasTotal / 30.4 : 0

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Proyección de entrega</h1>
          <p className="text-sm text-muted-foreground">
            Cuándo llegaría un pedido según el día en que empiece la fabricación, descontando las pausas de la fábrica.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={nueva}>
            <RotateCcw /> Nueva
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!proy}>
            <Printer /> Imprimir
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-xs print:hidden">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Empieza la fabricación">
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Field>
          <Field label="Días de fabricación" hint="Sin contar las pausas.">
            <Input inputMode="numeric" value={fab ?? String(plazos.diasFabricacion)} onChange={(e) => setFab(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Días de transporte" hint="Hasta el depósito. No lo frenan las pausas.">
            <Input inputMode="numeric" value={tra ?? String(plazos.diasTransito)} onChange={(e) => setTra(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Comparar con otro inicio" hint="Opcional.">
            <Input type="date" value={comparar} onChange={(e) => setComparar(e.target.value)} />
          </Field>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Pausas de la fábrica</p>
          {pausasDisponibles.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No hay pausas cargadas. Un admin las configura en Catálogos.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {pausasDisponibles.map((p) => (
                <label key={clavePausa(p)} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!apagadas.includes(clavePausa(p))}
                    onChange={(e) =>
                      setApagadas((a) => (e.target.checked ? a.filter((k) => k !== clavePausa(p)) : [...a, clavePausa(p)]))
                    }
                  />
                  {formatFecha(p.desde)} al {formatFecha(p.hasta)}
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      {!proy ? (
        <p className="mt-6 text-sm text-muted-foreground">Elige una fecha de inicio y los días de plazo para ver la proyección.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Dato etiqueta="Empieza la fabricación" valor={formatFecha(proy.inicio)} />
            <Dato etiqueta="Termina la fabricación" valor={formatFecha(proy.finFabricacion)} />
            <Dato etiqueta="Llega al depósito" valor={formatFecha(proy.llegada)} resaltar />
            <Dato
              etiqueta="Pausa durante la fabricación"
              valor={`${proy.diasPausa} ${proy.diasPausa === 1 ? 'día' : 'días'}`}
              nota={proy.diasPausa === 0 ? 'No le afecta ninguna pausa' : undefined}
            />
            <Dato etiqueta="Duración total" valor={`${proy.diasTotal} días`} nota={`unos ${meses.toFixed(1).replace('.', ',')} meses`} />
          </div>

          {comparar && (
            <p className="mt-3 rounded-md border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground">
              {otra && aDia(otra.llegada) !== null ? (
                <>
                  Si empieza el <strong>{formatFecha(otra.inicio)}</strong>, termina de fabricar el {formatFecha(otra.finFabricacion)} y llega
                  el <strong>{formatFecha(otra.llegada)}</strong>
                  {' — '}
                  {textoDiferencia(aDia(otra.llegada)! - aDia(proy.llegada)!)} que con el inicio principal.
                </>
              ) : (
                'La fecha para comparar no es válida.'
              )}
            </p>
          )}

          <div className="mt-5">
            <CalendarioProyeccion proyeccion={proy} />
          </div>

          {puedeEditar && (
            <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-xs print:hidden">
              <h2 className="text-sm font-semibold text-foreground">{idCargado ? 'Actualizar la proyección cargada' : 'Guardar esta proyección'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Se guarda con los plazos, las pausas y las fechas de este momento, aunque después cambie la configuración. Más adelante se podrá enlazar con un pedido real.
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Field label="Nombre *">
                  <Input value={nombre} maxLength={80} placeholder="Cliente X, calzado" onChange={(e) => setNombre(e.target.value)} />
                </Field>
                <Field label="Notas">
                  <Input value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />
                </Field>
                <Button onClick={onGuardar} disabled={guardando}>
                  <Save /> {guardando ? 'Guardando…' : idCargado ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </section>
          )}
        </>
      )}

      <section className="mt-8 print:hidden">
        <h2 className="text-sm font-semibold text-foreground">Proyecciones guardadas</h2>
        {error ? (
          <div className="mt-2">
            <ErrorBox mensaje={error} />
          </div>
        ) : guardadas.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{loading ? 'Cargando…' : 'Todavía no guardaste ninguna proyección.'}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Inicio</th>
                  <th className="px-4 py-2 font-medium">Fin de fabricación</th>
                  <th className="px-4 py-2 font-medium">Llegada</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {guardadas.map((g) => (
                  <tr key={g.id} className={g.id === idCargado ? 'bg-accent/50' : undefined}>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {g.nombre}
                      {g.notas && <p className="text-xs font-normal text-muted-foreground">{g.notas}</p>}
                    </td>
                    <td className="tabular px-4 py-2.5 text-muted-foreground">{formatFecha(g.inicio)}</td>
                    <td className="tabular px-4 py-2.5 text-muted-foreground">{formatFecha(g.finFabricacion)}</td>
                    <td className="tabular px-4 py-2.5 font-medium text-foreground">{formatFecha(g.llegada)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => cargar(g)}>
                        <FolderOpen /> Abrir
                      </Button>
                      {puedeEditar && (
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Borrar ${g.nombre}`} onClick={() => setBorrando(g)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        abierto={borrando !== null}
        titulo="Borrar proyección"
        textoConfirmar="Borrar"
        procesando={procesando}
        mensaje={
          <>
            Se borrará la proyección <strong>{borrando?.nombre}</strong>.
          </>
        }
        onCancelar={() => setBorrando(null)}
        onConfirmar={onBorrar}
      />
    </div>
  )
}

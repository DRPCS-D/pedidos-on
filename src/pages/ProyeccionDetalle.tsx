import { ArrowLeft, Pencil, Printer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarioProyeccion } from '@/components/proyeccion/CalendarioProyeccion'
import { ProyeccionFormModal } from '@/components/proyeccion/ProyeccionFormModal'
import { textoDiasHasta } from '@/components/proyeccion/textos'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { formatFecha, hoyIso } from '@/lib/format'
import { fechaDia, pausasDe, proyectar, proyectarInverso } from '@/lib/proyeccion'
import type { ProyeccionGuardada } from '@/lib/tipos'

function Dato({ etiqueta, valor, nota, resaltar }: { etiqueta: string; valor: string; nota?: string; resaltar?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${resaltar ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-card'}`}>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-foreground">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  )
}

/** Datos y calendario de una proyección, calculados desde la fecha que se indicó al crearla y los plazos guardados. */
function Cuerpo({ g }: { g: ProyeccionGuardada }) {
  const pausas = pausasDe(g.pausas)
  const esFinal = g.modo === 'final'
  const diasFab = Number(g.diasFabricacion)
  const diasTra = Number(g.diasTransito)
  // Desde la fecha que se indicó al crearla: el inicio o la llegada deseada (de la que sale la fecha límite).
  const base = fechaDia(g.fechaBase)
  const proy = esFinal ? proyectarInverso(base, diasFab, diasTra, pausas) : proyectar(base, diasFab, diasTra, pausas)
  if (!proy) return <ErrorBox mensaje="No se pudo calcular esta proyección con los datos guardados." />
  const meses = proy.diasTotal / 30.4

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {esFinal ? (
          <>
            <Dato etiqueta="El cliente quiere recibir" valor={formatFecha(base)} />
            <Dato
              etiqueta="Fecha límite para hacer el pedido"
              valor={formatFecha(proy.inicio)}
              nota={textoDiasHasta(proy.inicio, hoyIso(), 'límite')}
              resaltar
            />
            <Dato etiqueta="Termina la fabricación" valor={formatFecha(proy.finFabricacion)} />
            <Dato etiqueta="Llega al depósito" valor={formatFecha(proy.llegada)} />
          </>
        ) : (
          <>
            <Dato etiqueta="Empieza la fabricación" valor={formatFecha(proy.inicio)} nota={textoDiasHasta(proy.inicio, hoyIso(), 'de inicio')} />
            <Dato etiqueta="Termina la fabricación" valor={formatFecha(proy.finFabricacion)} />
            <Dato etiqueta="Llega al depósito" valor={formatFecha(proy.llegada)} resaltar />
          </>
        )}
        <Dato
          etiqueta="Pausa durante la fabricación"
          valor={`${proy.diasPausa} ${proy.diasPausa === 1 ? 'día' : 'días'}`}
          nota={proy.diasPausa === 0 ? 'No le afecta ninguna pausa' : undefined}
        />
        {!esFinal && <Dato etiqueta="Duración total" valor={`${proy.diasTotal} días`} nota={`unos ${meses.toFixed(1).replace('.', ',')} meses`} />}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {g.diasFabricacion} días de fabricación (sin contar las pausas) y {g.diasTransito} de transporte.{' '}
        {pausas.length > 0
          ? `Pausas descontadas: ${pausas.map((p) => `${p.anio} (${formatFecha(p.desde)} al ${formatFecha(p.hasta)})`).join(', ')}.`
          : 'Sin pausas.'}
      </p>

      <div className="mt-5">
        <CalendarioProyeccion proyeccion={proy} />
      </div>
    </>
  )
}

export default function ProyeccionDetalle() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { puedeEditar } = useAuth()
  const { data, loading, actualizando, error, borrar, refetch } = useCatalogo('proyecciones')
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const g = data.find((p) => p.id === id)

  // Mientras se baja la lista no se sabe todavía si el registro existe: nada de «No se encontró» por un instante.
  if ((loading || actualizando) && !g) return <Skeleton className="h-64 w-full" />
  if (error) return <ErrorBox mensaje={error} />
  if (!g) {
    return (
      <Vacio
        titulo="No se encontró la proyección"
        descripcion="Pudo haberse borrado."
        accion={
          <Button variant="outline" onClick={() => navigate('/proyeccion')}>
            Volver a proyecciones
          </Button>
        }
      />
    )
  }

  async function onBorrar() {
    if (!g) return
    setProcesando(true)
    const { error: err } = await borrar(g.id)
    setProcesando(false)
    if (err) return toast.error(err)
    toast.success('Proyección borrada.')
    refetch()
    navigate('/proyeccion', { replace: true })
  }

  return (
    <div>
      <Link to="/proyeccion" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="size-4" /> Proyecciones
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{g.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            Calculada desde la {g.modo === 'final' ? 'fecha final' : 'fecha de inicio'} ({formatFecha(g.fechaBase)})
            {g.notas ? ` · ${g.notas}` : ''}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
          {puedeEditar && (
            <>
              <Button variant="outline" onClick={() => setEditando(true)}>
                <Pencil /> Editar
              </Button>
              <Button variant="outline" onClick={() => setConfirmando(true)}>
                <Trash2 className="text-destructive" /> Borrar
              </Button>
            </>
          )}
        </div>
      </div>

      <Cuerpo g={g} />

      <ProyeccionFormModal
        proyeccion={editando ? g : null}
        onCerrar={() => setEditando(false)}
        onGuardada={() => {
          setEditando(false)
          refetch()
        }}
      />
      <ConfirmModal
        abierto={confirmando}
        titulo="Borrar proyección"
        textoConfirmar="Borrar"
        procesando={procesando}
        mensaje={
          <>
            Se borrará la proyección <strong>{g.nombre}</strong>.
          </>
        }
        onCancelar={() => setConfirmando(false)}
        onConfirmar={onBorrar}
      />
    </div>
  )
}

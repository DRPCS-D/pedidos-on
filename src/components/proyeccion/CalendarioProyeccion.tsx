import { aDia, mesesDe, type Proyeccion, type TipoDia } from '@/lib/proyeccion'
import { cn } from '@/lib/utils'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const COLOR_DIA: Record<TipoDia, string> = {
  fabricacion: 'bg-blue-500/20 text-foreground',
  pausa: 'bg-zinc-500/25 text-muted-foreground',
  transito: 'bg-emerald-500/20 text-foreground',
}

export const ETIQUETA_DIA: Record<TipoDia, string> = {
  fabricacion: 'Fabricación',
  pausa: 'Pausa de la fábrica',
  transito: 'Transporte marítimo',
}

/** Cada año tiene su color (los años impares uno y los pares otro) para distinguirlos de un vistazo al pasar de diciembre a enero. */
const COLOR_ANIO = {
  impar: { tarjeta: 'border-violet-500/50 bg-violet-500/5', titulo: 'text-violet-700 dark:text-violet-300', chip: 'bg-violet-500/20 text-violet-700 dark:text-violet-300' },
  par: { tarjeta: 'border-orange-500/50 bg-orange-500/5', titulo: 'text-orange-700 dark:text-orange-300', chip: 'bg-orange-500/20 text-orange-700 dark:text-orange-300' },
} as const
const colorDe = (anio: number) => (anio % 2 === 0 ? COLOR_ANIO.par : COLOR_ANIO.impar)

const dosDigitos = (n: number) => String(n).padStart(2, '0')

function Mes({ anio, mes, p }: { anio: number; mes: number; p: Proyeccion }) {
  const primero = new Date(Date.UTC(anio, mes, 1))
  const huecos = (primero.getUTCDay() + 6) % 7 // la semana empieza el lunes
  const diasDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const inicio = aDia(p.inicio)
  const fin = aDia(p.finFabricacion)
  const llegada = aDia(p.llegada)

  return (
    <section className={cn('rounded-lg border p-3 shadow-xs print:break-inside-avoid', colorDe(anio).tarjeta)}>
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {MESES[mes]} <span className={cn('font-medium', colorDe(anio).titulo)}>{anio}</span>
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {SEMANA.map((d, i) => (
          <div key={i} className="pb-1 text-[10px] font-medium uppercase text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: huecos }, (_, i) => (
          <div key={`h${i}`} />
        ))}
        {Array.from({ length: diasDelMes }, (_, i) => {
          const n = i + 1
          const dia = aDia(`${anio}-${dosDigitos(mes + 1)}-${dosDigitos(n)}`)!
          const tipo = p.dias.get(dia)
          const marca = dia === inicio ? 'Inicio' : dia === llegada ? 'Llega' : dia === fin ? 'Fin fab.' : ''
          return (
            <div
              key={n}
              title={tipo ? `${dosDigitos(n)}/${dosDigitos(mes + 1)}/${anio} · ${marca || ETIQUETA_DIA[tipo]}` : undefined}
              className={cn(
                'flex h-11 flex-col items-center justify-center rounded-md text-xs tabular',
                tipo ? COLOR_DIA[tipo] : 'text-muted-foreground/70',
                dia === inicio && 'ring-2 ring-blue-500 font-semibold',
                dia === fin && dia !== llegada && 'ring-2 ring-amber-500 font-semibold',
                dia === llegada && 'bg-red-500 font-semibold text-white',
              )}
            >
              <span>{n}</span>
              {marca && <span className="text-[9px] leading-none">{marca}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Calendario mensual en grilla: cada día pintado según sea fabricación, pausa o transporte, con el inicio, el fin de la fabricación y la llegada marcados. */
export function CalendarioProyeccion({ proyeccion }: { proyeccion: Proyeccion }) {
  const meses = mesesDe(proyeccion)
  const anios = [...new Set(meses.map((m) => m.anio))]
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {anios.map((a) => (
            <span key={a} className={cn('rounded-full px-2 py-0.5 font-medium', colorDe(a).chip)}>
              {a}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-blue-500/30" /> Fabricación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-zinc-500/35" /> Pausa de la fábrica
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-emerald-500/30" /> Transporte marítimo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-2 ring-blue-500" /> Inicio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-2 ring-amber-500" /> Fin de fabricación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-red-500" /> Llegada al depósito
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {meses.map((m) => (
          <Mes key={`${m.anio}-${m.mes}`} anio={m.anio} mes={m.mes} p={proyeccion} />
        ))}
      </div>
    </div>
  )
}

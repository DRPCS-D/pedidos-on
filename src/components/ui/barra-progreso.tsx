import { cn } from '@/lib/utils'

const COLOR = { normal: 'bg-primary', aviso: 'bg-warning', atrasado: 'bg-destructive' } as const

/** Barra de avance de 0 a 100. El color indica si va bien, si está por vencer o si ya se pasó. */
export function BarraProgreso({ pct, tono = 'normal' }: { pct: number; tono?: keyof typeof COLOR }) {
  const valor = Math.min(100, Math.max(0, Math.round(pct)))
  return (
    <div role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className={cn('h-full rounded-full transition-[width]', COLOR[tono])} style={{ width: `${valor}%` }} />
    </div>
  )
}

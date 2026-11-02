import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Caja con altura limitada: se ve lo primero y el resto con scroll. */
export function CajaScroll({ alto, className, children }: { alto: string; className?: string; children: ReactNode }) {
  return <div className={cn('overflow-y-auto', alto, className)}>{children}</div>
}

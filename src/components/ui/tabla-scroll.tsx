import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAltoRestante } from '@/hooks/useAltoRestante'

const PASO = 50
/** Distancia al final del scroll (px) a la que se piden más filas. */
const UMBRAL_PX = 300

/**
 * Tabla que llega hasta el borde inferior de la ventana, con scroll interno,
 * cabecera fija y pie «Mostrando X de Y». Solo se pintan `PASO` filas y se
 * suman más a medida que se hace scroll, para que miles de filas no cuelguen
 * el navegador.
 *
 * `children` recibe cuántas filas pintar y devuelve el `<thead>` y el
 * `<tbody>` (con `filas.slice(0, limite)`). `clave` identifica el filtro
 * actual: cuando cambia, vuelve al principio y a las primeras 50 filas.
 */
export function TablaScroll({
  total,
  clave = '',
  children,
}: {
  total: number
  clave?: string
  children: (limite: number) => ReactNode
}) {
  const tarjeta = useAltoRestante<HTMLDivElement>(32, true)
  const scroller = useRef<HTMLDivElement>(null)

  // Si cambia el filtro se vuelve a 50 sin necesitar un efecto que fije estado.
  const [estado, setEstado] = useState({ clave, limite: PASO })
  const limite = estado.clave === clave ? estado.limite : PASO
  const mostradas = Math.min(limite, total)

  function pedirMas() {
    if (limite < total) setEstado({ clave, limite: limite + PASO })
  }

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [clave])

  // Si las filas pintadas no llenan el contenedor (pantalla alta), no habría
  // forma de hacer scroll para pedir más: se completan solas.
  useEffect(() => {
    const el = scroller.current
    if (el && limite < total && el.scrollHeight <= el.clientHeight + 1) pedirMas()
  })

  return (
    <div ref={tarjeta} className="flex min-h-64 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.scrollHeight - el.scrollTop - el.clientHeight < UMBRAL_PX) pedirMas()
        }}
        className="min-h-0 flex-1 overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card [&_thead]:shadow-[0_1px_0_0_var(--color-border)] [&_thead_tr]:border-0"
      >
        <table className="w-full text-sm">{children(limite)}</table>
      </div>
      <div className="tabular border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Mostrando {mostradas.toLocaleString('es-PY')} de {total.toLocaleString('es-PY')}
      </div>
    </div>
  )
}

/**
 * Proyección de entrega: desde el día en que empieza la fabricación, esta corre `diasFabricacion` días
 * sin contar los de las pausas (Año Nuevo Chino: la fábrica no produce), y después el transporte marítimo
 * suma `diasTransito` días corridos, que no se frenan por ninguna pausa.
 * Las fechas son 'yyyy-MM-dd'; los días se cuentan como números para no depender de la zona horaria.
 */
import type { Config } from './tipos'

/** Rango de días en que la fábrica no produce, ambos extremos incluidos. */
export interface Pausa {
  desde: string
  hasta: string
}

export type TipoDia = 'fabricacion' | 'pausa' | 'transito'

export const DIAS_FABRICACION_INICIAL = 90
export const DIAS_TRANSITO_INICIAL = 90

const MS_DIA = 86_400_000
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'yyyy-MM-dd' → número de día (0 = 1970-01-01), o null si no es una fecha válida. */
export function aDia(iso: string): number | null {
  const m = FECHA.exec(iso)
  if (!m) return null
  const n = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const f = new Date(n)
  // Rechaza fechas que el motor "corrige" (31 de febrero).
  if (f.getUTCFullYear() !== Number(m[1]) || f.getUTCMonth() !== Number(m[2]) - 1 || f.getUTCDate() !== Number(m[3])) return null
  return n / MS_DIA
}

/** Número de día → 'yyyy-MM-dd'. */
export function deDia(dia: number): string {
  return new Date(dia * MS_DIA).toISOString().slice(0, 10)
}

/** Pausas guardadas (texto JSON); ignora lo que no tenga el formato esperado y ordena por fecha. */
export function pausasDe(texto: string | undefined | null): Pausa[] {
  if (!texto) return []
  try {
    const lista: unknown = JSON.parse(texto)
    if (!Array.isArray(lista)) return []
    return lista
      .map((p: Partial<Pausa>) => ({ desde: String(p?.desde ?? ''), hasta: String(p?.hasta ?? '') }))
      .filter((p) => {
        const a = aDia(p.desde)
        const b = aDia(p.hasta)
        return a !== null && b !== null && a <= b
      })
      .sort((a, b) => a.desde.localeCompare(b.desde))
  } catch {
    return []
  }
}

export interface Proyeccion {
  inicio: string
  /** Último día de fabricación. */
  finFabricacion: string
  /** Llegada al depósito. */
  llegada: string
  /** Días de pausa que cayeron durante la fabricación. */
  diasPausa: number
  /** Días corridos de inicio a llegada. */
  diasTotal: number
  /** Qué ocurre cada día entre el inicio y la llegada (clave: número de día). */
  dias: Map<number, TipoDia>
}

/** Calcula la proyección, o null si los datos no sirven. */
export function proyectar(inicio: string, diasFabricacion: number, diasTransito: number, pausas: Pausa[]): Proyeccion | null {
  const ini = aDia(inicio)
  if (ini === null) return null
  if (!(diasFabricacion >= 1) || !(diasTransito >= 0)) return null
  const rangos = pausas.flatMap((p) => {
    const a = aDia(p.desde)
    const b = aDia(p.hasta)
    return a !== null && b !== null && a <= b ? [[a, b] as const] : []
  })
  const enPausa = (d: number) => rangos.some(([a, b]) => d >= a && d <= b)

  const dias = new Map<number, TipoDia>()
  dias.set(ini, enPausa(ini) ? 'pausa' : 'fabricacion')
  let restan = Math.floor(diasFabricacion)
  let dia = ini
  let diasPausa = enPausa(ini) ? 1 : 0
  // Tope de seguridad: con pausas absurdamente largas no se cuelga la pantalla.
  for (let vuelta = 0; restan > 0 && vuelta < 20_000; vuelta++) {
    dia++
    if (enPausa(dia)) {
      dias.set(dia, 'pausa')
      diasPausa++
    } else {
      dias.set(dia, 'fabricacion')
      restan--
    }
  }
  if (restan > 0) return null
  const fin = dia
  const llegada = fin + Math.floor(diasTransito)
  for (let d = fin + 1; d <= llegada; d++) dias.set(d, 'transito')

  return {
    inicio,
    finFabricacion: deDia(fin),
    llegada: deDia(llegada),
    diasPausa,
    diasTotal: llegada - ini,
    dias,
  }
}

/** Meses (año, mes 0-11) que cubre la proyección, del primero al último. */
export function mesesDe(p: Proyeccion): { anio: number; mes: number }[] {
  const ini = new Date(aDia(p.inicio)! * MS_DIA)
  const fin = new Date(aDia(p.llegada)! * MS_DIA)
  const meses: { anio: number; mes: number }[] = []
  let anio = ini.getUTCFullYear()
  let mes = ini.getUTCMonth()
  while (anio < fin.getUTCFullYear() || (anio === fin.getUTCFullYear() && mes <= fin.getUTCMonth())) {
    meses.push({ anio, mes })
    mes++
    if (mes > 11) {
      mes = 0
      anio++
    }
  }
  return meses
}

/** Plazos y pausas de la configuración, con los valores de siempre si todavía no se cargaron. */
export function plazosDe(c: Partial<Pick<Config, 'plazoFabricacion' | 'plazoTransito' | 'pausas'>> | undefined) {
  return {
    diasFabricacion: c?.plazoFabricacion || DIAS_FABRICACION_INICIAL,
    diasTransito: c?.plazoTransito || DIAS_TRANSITO_INICIAL,
    pausas: pausasDe(c?.pausas),
  }
}

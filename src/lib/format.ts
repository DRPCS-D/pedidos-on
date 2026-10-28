/** Formateo de fechas y texto de búsqueda. */

/** '2026-03-14T10:00:00.000Z' → '14/03/2026'. Recorta la hora si viene un timestamp. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  // 'yyyy-MM-dd' se lee como fecha local: new Date() la tomaría en UTC y podría mostrar el día anterior.
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  const d = String(f.getDate()).padStart(2, '0')
  const m = String(f.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${f.getFullYear()}`
}

/** '2026-03-14T13:05:00.000Z' → '14/03/2026 10:05' (hora local). */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  const hh = String(f.getHours()).padStart(2, '0')
  const mm = String(f.getMinutes()).padStart(2, '0')
  return `${formatFecha(iso)} ${hh}:${mm}`
}

/** Normaliza texto para buscar sin tildes ni mayusculas. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/** Recorta un texto a `n` caracteres, con "…" si se pasó. */
export function recortar(texto: string | null | undefined, n: number): string {
  const t = String(texto || '')
  return t.length > n ? t.slice(0, n) + '…' : t
}

/** 12345.5 → 'USD 12.345,50' */
export function formatUsd(n: number | null | undefined): string {
  return `USD ${(n ?? 0).toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 1234567 → '1.234.567 Gs' */
export function formatGs(n: number | null | undefined): string {
  return `${Math.round(n ?? 0).toLocaleString('es-PY')} Gs`
}

/** Cantidad sin decimales superfluos: 12 → '12', 2.5 → '2,5'. */
export function formatCantidad(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-PY', { maximumFractionDigits: 3 })
}

/** Fecha de hoy como 'yyyy-MM-dd' en hora local (valor de <input type="date">). */
export function hoyIso(): string {
  const f = new Date()
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

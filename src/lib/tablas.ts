/**
 * Caché de tablas con sincronización por "revisión".
 *
 * El backend lleva un contador por tabla (ver bumpRevision_ en Code.gs) que
 * sube con cada alta, edición o baja. Aquí cada tabla se guarda en memoria y
 * en localStorage junto con la revisión con la que se bajó. Al entrar a una
 * pantalla se pinta al instante lo que ya hay y se pregunta la revisión (una
 * llamada barata): si no cambió, no se vuelve a pedir la tabla. Mientras la
 * app está visible, un poll repite esa pregunta y refresca en silencio las
 * tablas abiertas que hayan cambiado.
 *
 * El store es único para toda la app, así que varias pantallas que usan la
 * misma tabla comparten datos y una sola descarga.
 */
import { callApi, conCredenciales } from './appsScript'
import { leerSesion } from './sesion'

export interface DefTabla {
  /** Acción de Apps Script que devuelve la tabla. */
  accion: string
  /** Propiedad de la respuesta que trae el arreglo. */
  campo: string
  /** Contador de `getRevisions` del que depende. */
  rev: string
  /** Si se guarda en localStorage (no tiene sentido para datos por tarea). */
  persistir: boolean
  mensajeError: string
}

function catalogo(rev: string, mensajeError: string): DefTabla {
  return { accion: 'listCatalogo', campo: 'registros', rev, persistir: true, mensajeError }
}

/**
 * Los catálogos comparten acción; se distinguen por el payload `{ tabla }` y
 * por el contador de revisión propio de cada uno.
 */
export const TABLAS = {
  proveedores: catalogo('proveedores', 'No se pudieron cargar los proveedores.'),
  clientes: catalogo('clientes', 'No se pudieron cargar los clientes.'),
  marcas: catalogo('marcas', 'No se pudieron cargar las marcas.'),
  tamanos: catalogo('tamanos', 'No se pudieron cargar los tamaños.'),
  productos: {
    accion: 'listProductos',
    campo: 'productos',
    rev: 'productos',
    persistir: true,
    mensajeError: 'No se pudieron cargar los productos.',
  },
  pedidos: {
    accion: 'listPedidos',
    campo: 'pedidos',
    rev: 'pedidos',
    persistir: true,
    mensajeError: 'No se pudieron cargar los pedidos.',
  },
  pedidosCliente: {
    accion: 'listPedidosCliente',
    campo: 'pedidosCliente',
    rev: 'pedidosCliente',
    persistir: true,
    mensajeError: 'No se pudieron cargar los pedidos de clientes.',
  },
  contenedores: {
    accion: 'listContenedores',
    campo: 'contenedores',
    rev: 'contenedores',
    persistir: true,
    mensajeError: 'No se pudieron cargar los contenedores.',
  },
  usuarios: {
    accion: 'listUsuarios',
    campo: 'usuarios',
    rev: 'usuarios',
    persistir: true,
    mensajeError: 'No se pudieron cargar los usuarios.',
  },
  config: {
    accion: 'getConfig',
    campo: 'config',
    rev: 'config',
    persistir: true,
    mensajeError: 'No se pudo cargar la configuración.',
  },
  historial: {
    accion: 'listHistorial',
    campo: 'historial',
    rev: 'historial',
    persistir: false,
    mensajeError: 'No se pudo cargar el historial.',
  },
  archivos: {
    accion: 'listArchivos',
    campo: 'archivos',
    rev: 'archivos',
    persistir: false,
    mensajeError: 'No se pudieron cargar los archivos.',
  },
} as const satisfies Record<string, DefTabla>

export interface Entrada {
  data: unknown[]
  tieneDatos: boolean
  /** Hay una descarga en curso. */
  cargando: boolean
  /** Solo se informa si no hay datos que mostrar; con datos, un fallo es silencioso. */
  error: string | null
  /** Revisión con la que se bajó `data`. */
  rev: number | null
}

export const VACIA: Entrada = { data: [], tieneDatos: false, cargando: false, error: null, rev: null }

const PREFIJO_CACHE = 'pedidos-on:cache:'
const INTERVALO_MS = 300_000
/** Al volver a la pestaña no se re-sincroniza si se hizo hace menos de esto. */
const PAUSA_VISIBLE_MS = 15_000

const entradas = new Map<string, Entrada>()
const registro = new Map<string, { def: DefTabla; payload: Record<string, unknown> }>()
const refs = new Map<string, number>()
const enVuelo = new Map<string, Promise<boolean>>()
const oyentes = new Set<() => void>()
let generacion = 0
let forzando = false
let revsEnVuelo: Promise<Record<string, number>> | null = null
let temporizador: ReturnType<typeof setInterval> | null = null
let alVolverVisible: (() => void) | null = null
let ultimaSync = 0

export function idTabla(def: DefTabla, payloadJson: string): string {
  return `${def.accion}|${payloadJson}`
}

// ── Suscripción (useSyncExternalStore) ──

export function suscribir(fn: () => void): () => void {
  oyentes.add(fn)
  return () => {
    oyentes.delete(fn)
  }
}

function emitir() {
  oyentes.forEach((fn) => fn())
}

export function estaForzando(): boolean {
  return forzando
}

// ── Caché local ──

/** La clave lleva el usuario: en un equipo compartido nadie ve la caché de otro. */
function claveCache(id: string): string | null {
  const s = leerSesion()
  return s ? `${PREFIJO_CACHE}${s.usuario.toUpperCase()}:${id}` : null
}

function guardarCache(id: string, def: DefTabla, data: unknown[], rev: number | null) {
  if (!def.persistir) return
  try {
    const k = claveCache(id)
    if (k) localStorage.setItem(k, JSON.stringify({ data, rev }))
  } catch {
    // Cuota llena o sin localStorage: solo no se cachea esta vez.
  }
}

/** Devuelve la entrada de la tabla; la primera vez la hidrata desde localStorage. */
export function leerEntrada(id: string, def: DefTabla): Entrada {
  const existente = entradas.get(id)
  if (existente) return existente

  let e = VACIA
  if (def.persistir) {
    try {
      const k = claveCache(id)
      const cruda = k ? localStorage.getItem(k) : null
      if (cruda) {
        const p = JSON.parse(cruda) as { data?: unknown; rev?: unknown }
        if (Array.isArray(p.data)) {
          e = { ...VACIA, data: p.data, tieneDatos: true, rev: typeof p.rev === 'number' ? p.rev : null }
        }
      }
    } catch {
      // caché corrupta: se ignora
    }
  }
  entradas.set(id, e)
  return e
}

function poner(id: string, parche: Partial<Entrada>) {
  entradas.set(id, { ...(entradas.get(id) ?? VACIA), ...parche })
  emitir()
}

// ── Red ──

function revisiones(fresco: boolean): Promise<Record<string, number>> {
  // Las consultas de montaje se comparten; tras una escritura propia hay que
  // pedir una nueva, porque la que va en vuelo pudo salir antes del cambio.
  if (revsEnVuelo && !fresco) return revsEnVuelo
  const p = callApi<{ revisiones: Record<string, number> }>('getRevisions', conCredenciales())
    .then((r) => r.revisiones)
    .finally(() => {
      if (revsEnVuelo === p) revsEnVuelo = null
    })
  revsEnVuelo = p
  return p
}

/** Baja la tabla completa. Devuelve si salió bien. */
function traer(id: string, rev: number | null, reintentar: boolean): Promise<boolean> {
  const previo = enVuelo.get(id)
  if (previo) return reintentar ? previo.then(() => traer(id, rev, false)) : previo

  const reg = registro.get(id)
  if (!reg) return Promise.resolve(true)
  const gen = generacion
  poner(id, { cargando: true, error: null })

  const ejecutar = async (): Promise<boolean> => {
    try {
      const resp = await callApi<Record<string, unknown[]>>(reg.def.accion, conCredenciales({ ...reg.payload }))
      if (gen !== generacion) return true // se cerró sesión mientras tanto
      const data = resp[reg.def.campo] ?? []
      poner(id, { data, tieneDatos: true, cargando: false, error: null, rev })
      guardarCache(id, reg.def, data, rev)
      return true
    } catch (e) {
      if (gen !== generacion) return true
      const tieneDatos = (entradas.get(id) ?? VACIA).tieneDatos
      poner(id, {
        cargando: false,
        error: tieneDatos ? null : e instanceof Error ? e.message : reg.def.mensajeError,
      })
      return false
    }
  }
  const p: Promise<boolean> = ejecutar().finally(() => {
    if (enVuelo.get(id) === p) enVuelo.delete(id)
  })
  enVuelo.set(id, p)
  return p
}

/** Al montar una pantalla: si hay caché y la revisión no cambió, no pide nada. */
async function validar(id: string) {
  const reg = registro.get(id)
  if (!reg) return
  let rev: number | null = null
  try {
    rev = (await revisiones(false))[reg.def.rev] ?? null
  } catch {
    if (leerEntrada(id, reg.def).tieneDatos) return // sin red: se queda con la caché
  }
  const actual = leerEntrada(id, reg.def)
  if (actual.tieneDatos && rev !== null && rev === actual.rev) return
  await traer(id, rev, false)
}

/** Un componente empieza a usar la tabla. Devuelve la función para soltarla. */
export function montar(id: string, def: DefTabla, payload: Record<string, unknown>): () => void {
  registro.set(id, { def, payload })
  refs.set(id, (refs.get(id) ?? 0) + 1)
  void validar(id)
  return () => {
    refs.set(id, Math.max(0, (refs.get(id) ?? 1) - 1))
  }
}

/**
 * Revisa los contadores y refresca las tablas abiertas que cambiaron. Con
 * `forzar` baja todas sin comparar (aunque falle la consulta de contadores) y
 * marca las demás como vencidas. Devuelve false si alguna descarga falló.
 */
export async function sincronizar(forzar = false): Promise<boolean> {
  ultimaSync = Date.now()
  const activos = [...refs].filter(([, n]) => n > 0).map(([id]) => id)
  let revs: Record<string, number> | null = null
  try {
    revs = await revisiones(true)
  } catch {
    if (!forzar) return false
  }

  const resultados = await Promise.all(
    activos.map((id) => {
      const reg = registro.get(id)
      if (!reg) return true
      const e = leerEntrada(id, reg.def)
      const rev = revs?.[reg.def.rev] ?? null
      if (!forzar && e.tieneDatos && rev !== null && rev === e.rev) return true
      return traer(id, rev, true)
    }),
  )

  if (forzar) {
    // Las tablas que no están abiertas se revalidan al volver a entrar.
    for (const [id, e] of entradas) {
      if (!activos.includes(id) && e.tieneDatos) entradas.set(id, { ...e, rev: null })
    }
  }
  return resultados.every(Boolean)
}

/** Botón "Actualizar": baja todo de nuevo, aunque los contadores digan que no hay cambios. */
export async function forzarTodo(): Promise<boolean> {
  forzando = true
  emitir()
  try {
    return await sincronizar(true)
  } finally {
    forzando = false
    emitir()
  }
}

// ── Ciclo de vida ──

function tick() {
  if (document.visibilityState === 'visible' && leerSesion()) void sincronizar()
}

function alVolver() {
  if (Date.now() - ultimaSync > PAUSA_VISIBLE_MS) tick()
}

/** Arranca el poll periódico (solo mientras hay sesión). */
export function iniciarSync() {
  if (temporizador) return
  temporizador = setInterval(tick, INTERVALO_MS)
  alVolverVisible = alVolver
  document.addEventListener('visibilitychange', alVolverVisible)
}

export function detenerSync() {
  if (temporizador) clearInterval(temporizador)
  temporizador = null
  if (alVolverVisible) document.removeEventListener('visibilitychange', alVolverVisible)
  alVolverVisible = null
}

/** Cierre de sesión: vacía memoria y localStorage para no dejar datos en equipos compartidos. */
export function limpiarTablas() {
  generacion++
  entradas.clear()
  enVuelo.clear()
  revsEnVuelo = null
  detenerSync()
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIJO_CACHE)) localStorage.removeItem(k)
    }
  } catch {
    // no-op
  }
  emitir()
}

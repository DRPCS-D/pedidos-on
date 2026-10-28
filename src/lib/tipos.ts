/**
 * Tipos del dominio. Se escriben a mano (no hay esquema que generar: el
 * backend es Apps Script sobre Google Sheets, no una base tipada).
 */

/** Coincide con lo que devuelve `normalizarRol_` en apps-script/Code.gs. */
export type Rol = 'admin' | 'operador' | 'consulta'

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Admin',
  operador: 'Operador',
  consulta: 'Consulta',
}

// ── Estados ──

export type EstadoPedido =
  | 'registrado'
  | 'confirmado'
  | 'en_fabricacion'
  | 'fabricado'
  | 'embarcado'
  | 'en_transito'
  | 'en_puerto'
  | 'desembarcado'
  | 'entregado'
  | 'cancelado'

/** En orden de avance (cancelado al final). */
export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'registrado',
  'confirmado',
  'en_fabricacion',
  'fabricado',
  'embarcado',
  'en_transito',
  'en_puerto',
  'desembarcado',
  'entregado',
  'cancelado',
]

export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  registrado: 'Registrado',
  confirmado: 'Confirmado',
  en_fabricacion: 'En fabricación',
  fabricado: 'Fabricado',
  embarcado: 'Embarcado',
  en_transito: 'En tránsito',
  en_puerto: 'En puerto / aduana',
  desembarcado: 'Desembarcado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Los que se ponen a mano; los demás los dan los contenedores. */
export const ESTADOS_PEDIDO_MANUALES: EstadoPedido[] = [
  'registrado',
  'confirmado',
  'en_fabricacion',
  'fabricado',
  'entregado',
  'cancelado',
]

export type EstadoContenedor = 'preparando' | 'embarcado' | 'en_transito' | 'en_puerto' | 'desembarcado'

export const ESTADOS_CONTENEDOR: EstadoContenedor[] = [
  'preparando',
  'embarcado',
  'en_transito',
  'en_puerto',
  'desembarcado',
]

export const ESTADO_CONTENEDOR_LABEL: Record<EstadoContenedor, string> = {
  preparando: 'Preparando',
  embarcado: 'Embarcado',
  en_transito: 'En tránsito',
  en_puerto: 'En puerto / aduana',
  desembarcado: 'Desembarcado',
}

export type TipoContenedor = '20' | '40' | '40HC' | 'otro'

export const TIPO_CONTENEDOR_LABEL: Record<TipoContenedor, string> = {
  '20': "20'",
  '40': "40'",
  '40HC': "40' HC",
  otro: 'Otro',
}

// ── Catálogos ──

export interface Proveedor {
  id: string
  nombre: string
  contacto: string
  telefono: string
  email: string
  ciudad: string
  notas: string
  activo: boolean
}

export interface Cliente {
  id: string
  nombre: string
  ruc: string
  telefono: string
  email: string
  direccion: string
  notas: string
  activo: boolean
}

/** Marcas y tamaños comparten forma. */
export interface ItemCatalogo {
  id: string
  nombre: string
  activo: boolean
}

export type NombreCatalogo = 'proveedores' | 'clientes' | 'marcas' | 'tamanos'

export interface Producto {
  id: string
  codigo: string
  descripcion: string
  color: string
  marcaId: string
  tamanoId: string
  /** Fábrica habitual (opcional). */
  proveedorId: string
  /** USD */
  precioCosto: number
  /** USD */
  precioVentaUsd: number
  /** Guaraníes */
  precioVentaGs: number
  activo: boolean
  /** Id de Drive de la foto principal, vacío si no tiene. */
  fotoId: string
}

// ── Pedidos y contenedores ──

export interface LineaPedido {
  id: string
  pedidoId: string
  productoId: string
  codigo: string
  descripcion: string
  color: string
  marca: string
  tamano: string
  cantidad: number
  precioCosto: number
  precioVentaUsd: number
  precioVentaGs: number
  /** Cantidad ya cargada en contenedores (calculado por el backend). */
  cargado: number
}

export interface Pedido {
  id: string
  folio: string
  proveedorId: string
  clienteId: string
  estado: EstadoPedido
  /** 'yyyy-MM-dd' */
  fechaPedido: string
  notas: string
  creadoPor: string
  creadoNombre: string
  fechaCreacion: string
  /** Fecha del último cambio de estado, 'yyyy-MM-dd'. */
  fechaEstado: string
  lineas: LineaPedido[]
}

export interface Carga {
  id: string
  contenedorId: string
  pedidoId: string
  lineaId: string
  cantidad: number
}

export interface Contenedor {
  id: string
  numero: string
  tipo: TipoContenedor
  naviera: string
  bl: string
  puertoOrigen: string
  puertoDestino: string
  /** 'yyyy-MM-dd' estimada de salida */
  etd: string
  /** 'yyyy-MM-dd' estimada de llegada */
  eta: string
  estado: EstadoContenedor
  notas: string
  creadoPor: string
  creadoNombre: string
  fechaCreacion: string
  cargas: Carga[]
}

export interface RegistroHistorial {
  id: string
  entidad: 'pedido' | 'contenedor'
  entidadId: string
  estado: string
  /** 'yyyy-MM-dd' */
  fecha: string
  usuario: string
  usuarioNombre: string
  nota: string
  registrado: string
}

export interface Archivo {
  id: string
  entidad: 'producto' | 'pedido'
  entidadId: string
  driveId: string
  nombre: string
  mime: string
  bytes: number
  principal: boolean
  subidoPor: string
  subidoNombre: string
  fecha: string
}

export interface Config {
  tipoCambio: number
}

export interface UsuarioApp {
  /** Nombre de acceso (login). */
  usuario: string
  /** Nombre completo, opcional. */
  nombre: string
  rol: Rol
  activo: boolean
}

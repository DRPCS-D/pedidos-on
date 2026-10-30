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

/** Las marcas son solo nombre. */
export interface ItemCatalogo {
  id: string
  nombre: string
  activo: boolean
}

/** Un tamaño pertenece a un grupo (Calzado, Ropa…) y se ordena por `orden` dentro de él. */
export interface Tamano extends ItemCatalogo {
  grupo: string
  orden: number
}

/** Fórmula de precio de venta: `pasos` es un texto JSON (ver lib/precio.ts). */
export interface TablaPrecio extends ItemCatalogo {
  pasos: string
}

/** Proyección de entrega guardada: con qué datos se calculó y las fechas que dio. */
export interface ProyeccionGuardada extends ItemCatalogo {
  /** 'yyyy-MM-dd' */
  inicio: string
  diasFabricacion: string
  diasTransito: string
  /** Pausas usadas, como JSON. */
  pausas: string
  finFabricacion: string
  llegada: string
  notas: string
}

export type NombreCatalogo = 'proveedores' | 'clientes' | 'marcas' | 'tamanos' | 'tablasPrecio' | 'proyecciones'

/** Modificación del precio de una línea ya cargada en un pedido. */
export interface CambioPrecio {
  id: string
  entidad: 'pedido' | 'pedidoCliente'
  entidadId: string
  productoId: string
  codigo: string
  descripcion: string
  campo: 'precioCosto' | 'precioVentaUsd' | 'precioVentaGs'
  anterior: number
  nuevo: number
  usuario: string
  usuarioNombre: string
  /** ISO con hora. */
  cuando: string
}

export interface Producto {
  id: string
  codigo: string
  descripcion: string
  marcaId: string
  /** Fábrica habitual (opcional). */
  proveedorId: string
  /** USD */
  precioCosto: number
  /** USD */
  precioVentaUsd: number
  /** Guaraníes */
  precioVentaGs: number
  activo: boolean
  /** Tabla de precios con la que se calcula el precio de venta (vacío = ninguna). */
  tablaPrecioId: string
  /** Id de Drive de la foto principal, vacío si no tiene. */
  fotoId: string
  /** Foto principal de cada color que tiene fotos propias (color → id de Drive). */
  fotosColor: Record<string, string>
  /** Colores en que viene (vacío = sin variantes de color). */
  colores: string[]
  /** Ids de los tamaños en que viene, ordenados por grupo y orden (vacío = sin tamaños). */
  tamanoIds: string[]
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
  tamanoId: string
  cantidad: number
  /** Unidades de este tamaño en una caja (curva) y cajas del color; 0 si se cargó solo la cantidad. */
  porCaja: number
  cajas: number
  precioCosto: number
  precioVentaUsd: number
  precioVentaGs: number
  /** Cantidad ya cargada en contenedores (calculado por el backend). */
  cargado: number
  /** Cantidad ya asignada a pedidos de cliente; el resto es stock propio. */
  asignado: number
}

export type DescuentoTipo = '' | 'porcentaje' | 'monto'

/** Gasto adicional del pedido a fábrica (flete, seguro, muestras…), en USD. */
export interface CargoPedido {
  concepto: string
  monto: number
}

export interface Pedido {
  id: string
  folio: string
  proveedorId: string
  estado: EstadoPedido
  /** 'yyyy-MM-dd' */
  fechaPedido: string
  notas: string
  /** Descuento sobre el total de costos: porcentaje (0-100) o monto en USD. */
  descuentoTipo: DescuentoTipo
  descuentoValor: number
  descuentoMotivo: string
  cargos: CargoPedido[]
  creadoPor: string
  creadoNombre: string
  fechaCreacion: string
  /** Fecha del último cambio de estado, 'yyyy-MM-dd'. */
  fechaEstado: string
  lineas: LineaPedido[]
}

export type EstadoPedidoCliente = 'registrado' | 'entregado' | 'cancelado'

export const ESTADO_PC_LABEL: Record<EstadoPedidoCliente, string> = {
  registrado: 'Registrado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Lo que pidió el cliente de una variante (producto, color y tamaño) y cuánto está cubierto. */
export interface LineaPedidoCliente {
  id: string
  pcId: string
  productoId: string
  codigo: string
  descripcion: string
  color: string
  marca: string
  tamano: string
  tamanoId: string
  cantidad: number
  precioVentaUsd: number
  precioVentaGs: number
  porCaja: number
  cajas: number
  /** Unidades cubiertas desde pedidos a fábrica y de dónde vienen. */
  asignado: number
  asignaciones: { lineaId: string; pedidoId: string; cantidad: number }[]
}

export interface PedidoCliente {
  id: string
  folio: string
  clienteId: string
  estado: EstadoPedidoCliente
  /** 'yyyy-MM-dd' */
  fecha: string
  notas: string
  creadoPor: string
  creadoNombre: string
  fechaCreacion: string
  fechaEstado: string
  lineas: LineaPedidoCliente[]
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
  entidad: 'pedido' | 'contenedor' | 'pedidoCliente'
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
  /** Color del producto al que pertenece la foto; vacío = foto general. */
  color: string
}

export interface Config {
  tipoCambio: number
  /** Datos de la empresa para los documentos (varias líneas). */
  empresa: string
  /** Condiciones del pedido de cliente (varias líneas). */
  condiciones: string
  /** Días que tarda la fábrica en producir, sin contar las pausas. */
  plazoFabricacion: number
  /** Días de transporte marítimo hasta el depósito. */
  plazoTransito: number
  /** Pausas de la fábrica (Año Nuevo Chino…), como JSON: [{desde, hasta}]. */
  pausas: string
}

export interface UsuarioApp {
  /** Nombre de acceso (login). */
  usuario: string
  /** Nombre completo, opcional. */
  nombre: string
  rol: Rol
  activo: boolean
}

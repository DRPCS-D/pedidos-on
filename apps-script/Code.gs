/**
 * Pedidos ON - Backend (Google Apps Script)
 *
 * Seguimiento de pedidos a fábricas de China: catálogos (proveedores,
 * clientes, marcas, tamaños, productos con sus colores y tamaños), pedidos con
 * una línea por producto, color y tamaño, contenedores
 * con lo que lleva cada uno, historial de estados con fecha y archivos
 * (fotos de productos, documentos de pedidos) en una carpeta de Google Drive.
 *
 * Despliegue:
 *   Extensiones > Apps Script > pegar este archivo (y appsscript.json)
 *   > Implementar > Aplicación web
 *   > Ejecutar como: Yo | Quién tiene acceso: Cualquier usuario
 *
 * Primera vez: ejecuta la función `instalar` (botón Ejecutar en el editor, o
 * menú "Pedidos ON" de la hoja tras recargarla). Crea las pestañas de
 * ENCABEZADOS, la carpeta de Drive y un admin inicial (la contraseña queda en
 * la pestaña Usuarios). Es idempotente.
 * Funciona como script vinculado a un Sheet o como proyecto independiente
 * (crea el Sheet "Pedidos ON" en tu Drive y guarda su ID en SPREADSHEET_ID).
 *
 * Roles:
 *   admin     control total, usuarios, tipo de cambio, deshacer estados.
 *   operador  carga y modifica catálogos, pedidos y contenedores.
 *   consulta  solo lectura.
 *
 * Estados:
 *   El pedido avanza a mano hasta "fabricado". Desde que viaja, su estado lo
 *   dan los contenedores que lo llevan (el menos avanzado). "entregado" vuelve
 *   a ser manual. Cada cambio queda en la pestaña Historial con su fecha.
 */

// ---------- Estructura ----------

var ENCABEZADOS = {
  Usuarios: ['usuario', 'password', 'rol', 'activo', 'nombre'],
  Proveedores: ['id', 'nombre', 'contacto', 'telefono', 'email', 'ciudad', 'notas', 'activo'],
  Clientes: ['id', 'nombre', 'ruc', 'telefono', 'email', 'direccion', 'notas', 'activo'],
  Marcas: ['id', 'nombre', 'activo'],
  Tamanos: ['id', 'nombre', 'grupo', 'orden', 'activo'],
  Productos: ['id', 'codigo', 'descripcion', 'marcaId', 'proveedorId',
              'precioCosto', 'precioVentaUsd', 'precioVentaGs', 'activo', 'tablaPrecioId'],
  TablasPrecio: ['id', 'nombre', 'pasos', 'activo'],
  CambiosPrecio: ['id', 'entidad', 'entidadId', 'productoId', 'codigo', 'descripcion', 'campo', 'anterior', 'nuevo',
                  'usuario', 'cuando'],
  ProductoColores: ['id', 'productoId', 'color'],
  ProductoTamanos: ['id', 'productoId', 'tamanoId'],
  Pedidos: ['id', 'folio', 'proveedorId', 'clienteId', 'estado', 'fechaPedido', 'notas',
            'creadoPor', 'fechaCreacion', 'fechaEstado',
            'descuentoTipo', 'descuentoValor', 'descuentoMotivo', 'cargos'],
  PedidoLineas: ['id', 'pedidoId', 'productoId', 'codigo', 'descripcion', 'color', 'marca', 'tamano', 'tamanoId',
                 'cantidad', 'precioCosto', 'precioVentaUsd', 'precioVentaGs', 'porCaja', 'cajas'],
  Contenedores: ['id', 'numero', 'tipo', 'naviera', 'bl', 'puertoOrigen', 'puertoDestino', 'etd', 'eta',
                 'estado', 'notas', 'creadoPor', 'fechaCreacion'],
  Cargas: ['id', 'contenedorId', 'pedidoId', 'lineaId', 'cantidad'],
  PedidosCliente: ['id', 'folio', 'clienteId', 'estado', 'fecha', 'notas', 'creadoPor', 'fechaCreacion', 'fechaEstado'],
  PCLineas: ['id', 'pcId', 'productoId', 'codigo', 'descripcion', 'color', 'marca', 'tamano', 'tamanoId',
             'cantidad', 'precioVentaUsd', 'precioVentaGs', 'porCaja', 'cajas'],
  Asignaciones: ['id', 'pcLineaId', 'lineaId', 'cantidad'],
  Historial: ['id', 'entidad', 'entidadId', 'estado', 'fecha', 'usuario', 'nota', 'registrado'],
  Archivos: ['id', 'entidad', 'entidadId', 'driveId', 'nombre', 'mime', 'bytes', 'principal', 'subidoPor', 'fecha', 'color'],
  Proyecciones: ['id', 'nombre', 'inicio', 'diasFabricacion', 'diasTransito', 'pausas', 'finFabricacion', 'llegada', 'notas', 'activo',
                 'modo', 'fechaBase'],
  Config: ['clave', 'valor']
};

/** Columnas numéricas y de casilla: el resto se guarda como texto (formato @). */
var NUMERICAS = ['cantidad', 'precioCosto', 'precioVentaUsd', 'precioVentaGs', 'bytes', 'orden', 'porCaja', 'cajas', 'descuentoValor', 'anterior', 'nuevo'];
var CASILLAS = ['activo', 'principal'];
/** Columnas con fecha sin hora ('yyyy-MM-dd'); las demás fechas son ISO con hora. */
var FECHAS_DIA = ['fechaPedido', 'fechaEstado', 'etd', 'eta', 'inicio', 'finFabricacion', 'llegada', 'fechaBase'];

var ROLES = ['admin', 'operador', 'consulta'];
var EDITORES = ['admin', 'operador'];

var ESTADOS_PEDIDO = ['registrado', 'confirmado', 'en_fabricacion', 'fabricado', 'embarcado', 'en_transito',
                      'en_puerto', 'desembarcado', 'entregado', 'cancelado'];
/** Los que se ponen a mano; los demás (embarcado…desembarcado) vienen de los contenedores. */
var MANUALES_PEDIDO = ['registrado', 'confirmado', 'en_fabricacion', 'fabricado', 'entregado', 'cancelado'];
var ESTADOS_CONTENEDOR = ['preparando', 'embarcado', 'en_transito', 'en_puerto', 'desembarcado'];
var TIPOS_CONTENEDOR = ['20', '40', '40HC', 'otro'];
/** El pedido de cliente solo tiene estados manuales; dónde está su mercadería lo dan los pedidos a fábrica asignados. */
var ESTADOS_PC = ['registrado', 'entregado', 'cancelado'];

var MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;
var CARPETA_RAIZ = 'Pedidos ON - Archivos';

/**
 * Catálogos simples con alta/edición/baja genérica. `usadoEn` impide borrar
 * un registro referenciado (hay que desactivarlo).
 */
var CATALOGOS = {
  proveedores: {
    hoja: 'Proveedores', etiqueta: 'proveedor',
    campos: { nombre: 80, contacto: 80, telefono: 40, email: 80, ciudad: 60, notas: 1000 },
    usadoEn: [{ hoja: 'Pedidos', col: 'proveedorId' }, { hoja: 'Productos', col: 'proveedorId' }]
  },
  clientes: {
    hoja: 'Clientes', etiqueta: 'cliente',
    campos: { nombre: 80, ruc: 30, telefono: 40, email: 80, direccion: 150, notas: 1000 },
    usadoEn: [{ hoja: 'Pedidos', col: 'clienteId' }]
  },
  marcas: {
    hoja: 'Marcas', etiqueta: 'marca', femenino: true,
    campos: { nombre: 60 },
    usadoEn: [{ hoja: 'Productos', col: 'marcaId' }]
  },
  tamanos: {
    hoja: 'Tamanos', etiqueta: 'tamaño',
    campos: { nombre: 60, grupo: 40, orden: 6 },
    usadoEn: [{ hoja: 'ProductoTamanos', col: 'tamanoId' }]
  },
  // Fórmulas para calcular el precio de venta en USD a partir del costo; solo las edita el admin.
  tablasPrecio: {
    hoja: 'TablasPrecio', etiqueta: 'tabla de precios', femenino: true,
    campos: { nombre: 60, pasos: 4000 },
    usadoEn: [{ hoja: 'Productos', col: 'tablaPrecioId' }],
    soloAdmin: true,
    normalizar: function (obj) { obj.pasos = pasosPrecio_(obj.pasos); }
  },
  // Proyecciones de entrega guardadas (con los datos y las fechas del momento en que se calcularon).
  proyecciones: {
    hoja: 'Proyecciones', etiqueta: 'proyección', femenino: true,
    campos: { nombre: 80, inicio: 10, diasFabricacion: 4, diasTransito: 4, pausas: 2000, finFabricacion: 10, llegada: 10, notas: 1000,
              modo: 10, fechaBase: 10 },
    usadoEn: [],
    normalizar: function (obj) {
      ['inicio', 'finFabricacion', 'llegada', 'fechaBase'].forEach(function (k) { obj[k] = fechaDia_(obj[k], k); });
      // «inicio»: se partió de la fecha de inicio; «final»: de la llegada deseada y se calculó hasta cuándo se puede empezar.
      if (obj.modo !== 'inicio' && obj.modo !== 'final') throw new Error('El modo de cálculo no es válido.');
      ['diasFabricacion', 'diasTransito'].forEach(function (k) {
        var n = Math.floor(Number(obj[k]));
        if (!(n >= 0 && n <= 2000)) throw new Error('Los días de plazo no son válidos.');
        obj[k] = String(n);
      });
      obj.pausas = pausasConfig_(obj.pausas);
    }
  }
};

var REVISIONES = ['usuarios', 'proveedores', 'clientes', 'marcas', 'tamanos', 'productos', 'pedidos',
                  'contenedores', 'historial', 'archivos', 'config', 'pedidosCliente', 'tablasPrecio', 'cambiosPrecio', 'proyecciones'];

// ---------- Entrada ----------

/** En las acciones de escritura la respuesta lleva los contadores de revisión (ver jsonOut_). */
var ADJUNTAR_REVISIONES_ = false;

function doGet() {
  return jsonOut_({ ok: true, service: 'pedidos-on' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Solicitud inválida' });
  }

  // Las lecturas (list*, get*, login, fotos*) no llevan contadores; todo lo demás sí, para que el frontend no tenga que preguntarlos.
  ADJUNTAR_REVISIONES_ = !/^(list|get|login|fotos)/i.test(String(body.action || ''));

  try {
    switch (body.action) {
      case 'login':                  return handleLogin_(body);
      case 'getRevisions':           return handleGetRevisions_(body);
      case 'cambiarMiPassword':      return handleCambiarMiPassword_(body);
      case 'listUsuarios':           return handleListUsuarios_(body);
      case 'createUsuario':          return handleCreateUsuario_(body);
      case 'updateUsuario':          return handleUpdateUsuario_(body);
      case 'deleteUsuario':          return handleDeleteUsuario_(body);
      case 'listCatalogo':           return handleListCatalogo_(body);
      case 'guardarCatalogo':        return handleGuardarCatalogo_(body);
      case 'borrarCatalogo':         return handleBorrarCatalogo_(body);
      case 'listProductos':          return handleListProductos_(body);
      case 'guardarProducto':        return handleGuardarProducto_(body);
      case 'borrarProducto':         return handleBorrarProducto_(body);
      case 'listPedidos':            return handleListPedidos_(body);
      case 'guardarPedido':          return handleGuardarPedido_(body);
      case 'cambiarEstadoPedido':    return handleCambiarEstadoPedido_(body);
      case 'borrarPedido':           return handleBorrarPedido_(body);
      case 'listContenedores':       return handleListContenedores_(body);
      case 'guardarContenedor':      return handleGuardarContenedor_(body);
      case 'guardarCargas':          return handleGuardarCargas_(body);
      case 'cambiarEstadoContenedor': return handleCambiarEstadoContenedor_(body);
      case 'borrarContenedor':       return handleBorrarContenedor_(body);
      case 'deshacerEstado':         return handleDeshacerEstado_(body);
      case 'listPedidosCliente':     return handleListPedidosCliente_(body);
      case 'guardarPedidoCliente':   return handleGuardarPedidoCliente_(body);
      case 'asignarPedidoCliente':   return handleAsignarPedidoCliente_(body);
      case 'asignarAutomatico':      return handleAsignarAutomatico_(body);
      case 'cambiarEstadoPedidoCliente': return handleCambiarEstadoPedidoCliente_(body);
      case 'borrarPedidoCliente':    return handleBorrarPedidoCliente_(body);
      case 'listHistorial':          return handleListHistorial_(body);
      case 'listCambiosPrecio':      return handleListCambiosPrecio_(body);
      case 'getConfig':              return handleGetConfig_(body);
      case 'setConfig':              return handleSetConfig_(body);
      case 'listArchivos':           return handleListArchivos_(body);
      case 'fotosDocumento':         return handleFotosDocumento_(body);
      case 'subirArchivo':           return handleSubirArchivo_(body);
      case 'marcarPrincipal':        return handleMarcarPrincipal_(body);
      case 'borrarArchivo':          return handleBorrarArchivo_(body);
      default:                       return jsonOut_({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    // "codigo" deja que el frontend distinga una sesión caída de cualquier otro error.
    return jsonOut_({ ok: false, error: err.message || ('Error del servidor: ' + err), codigo: err.codigo || '' });
  }
}

// ---------- Autenticación ----------

function handleLogin_(body) {
  var user = findUser_(body.usuario, body.password);
  if (!user) return jsonOut_({ ok: false, error: 'Usuario o contraseña incorrectos' });
  return jsonOut_({ ok: true, usuario: user.usuario, nombre: user.nombre, rol: user.rol });
}

/** Valida credenciales y devuelve el usuario; si no, error con codigo 'SESION'. */
function requireAuth_(body) {
  var user = findUser_(body.usuario, body.password);
  if (!user) {
    var e = new Error('Sesión no válida. Vuelve a iniciar sesión.');
    e.codigo = 'SESION';
    throw e;
  }
  return user;
}

function requireRol_(body, roles) {
  var user = requireAuth_(body);
  if (roles.indexOf(user.rol) === -1) throw new Error('No autorizado para esta acción.');
  return user;
}

function requireAdmin_(body) { return requireRol_(body, ['admin']); }
function requireEditor_(body) { return requireRol_(body, EDITORES); }

/**
 * Las credenciales que ya se validaron se guardan unos minutos en la caché del script (con una huella SHA-256 como
 * clave: la contraseña no se guarda), para no leer la hoja Usuarios en cada llamada. Cualquier cambio de usuarios
 * hecho desde la app invalida la caché al instante (ver conLock_); lo que se edite a mano en la hoja se nota a
 * más tardar a los CACHE_AUTH_SEG segundos.
 */
var CACHE_AUTH_SEG = 300;
var CLAVE_VERSION_AUTH = 'auth_version';

function claveAuth_(nombre, pass) {
  var huella = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, nombre.toUpperCase() + '\n' + pass, Utilities.Charset.UTF_8);
  return 'auth_' + Utilities.base64Encode(huella);
}

/** Invalida todas las credenciales guardadas en caché (cambia la versión con la que se comparan). */
function invalidarAuth_() {
  try { CacheService.getScriptCache().put(CLAVE_VERSION_AUTH, Utilities.getUuid(), 21600); } catch (e) {}
}

function findUser_(usuario, password) {
  var nombre = String(usuario || '').trim();
  var pass = String(password || '');
  if (!nombre || !pass) return null;

  var cache = null, clave = '', version = '';
  try {
    cache = CacheService.getScriptCache();
    clave = claveAuth_(nombre, pass);
    var guardado = cache.getAll([clave, CLAVE_VERSION_AUTH]);
    version = guardado[CLAVE_VERSION_AUTH] || '';
    if (!version) {
      // Sin versión (primera vez o la caché la perdió): se crea una nueva, y con ella se descartan las entradas viejas.
      version = Utilities.getUuid();
      cache.put(CLAVE_VERSION_AUTH, version, 21600);
    } else if (guardado[clave]) {
      var c = JSON.parse(guardado[clave]);
      if (c.v === version) return c.u;
    }
  } catch (e) {
    cache = null; // sin caché disponible se valida contra la hoja, como siempre
  }

  var t = leer_('Usuarios');
  for (var i = 0; i < t.filas.length; i++) {
    var u = t.filas[i];
    // El usuario no distingue mayúsculas/minúsculas; la contraseña sí.
    if (u.usuario.toUpperCase() === nombre.toUpperCase() && String(u.password) === pass && u.activo) {
      var encontrado = { usuario: u.usuario, rol: normalizarRol_(u.rol), nombre: u.nombre };
      if (cache) { try { cache.put(clave, JSON.stringify({ v: version, u: encontrado }), CACHE_AUTH_SEG); } catch (e) {} }
      return encontrado;
    }
  }
  return null;
}

// ---------- Revisiones ----------
// Un contador por tabla en PropertiesService para que el frontend pregunte
// "¿cambió algo?" sin leer ninguna hoja. Se incrementa dentro del lock de cada
// escritura. Editar el Sheet a mano NO lo incrementa (para eso está el botón ↻).

function bumpRevision_(key) {
  var props = PropertiesService.getScriptProperties();
  var actual = Number(props.getProperty('rev_' + key)) || 0;
  props.setProperty('rev_' + key, String(actual + 1));
}

function revisionesActuales_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var revisiones = {};
  REVISIONES.forEach(function (k) { revisiones[k] = Number(props['rev_' + k]) || 0; });
  return revisiones;
}

function handleGetRevisions_(body) {
  requireAuth_(body);
  return jsonOut_({ ok: true, revisiones: revisionesActuales_() });
}

/** Ejecuta `fn` con el lock del script tomado y sube las revisiones indicadas. */
function conLock_(revs, fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = fn();
    revs.forEach(bumpRevision_);
    // Altas, cambios y bajas de usuarios (y de contraseñas): las credenciales en caché dejan de valer ya.
    if (revs.indexOf('usuarios') !== -1) invalidarAuth_();
    return r;
  } finally {
    lock.releaseLock();
  }
}

// ---------- Usuarios ----------

function handleListUsuarios_(body) {
  requireAdmin_(body);
  var usuarios = leer_('Usuarios').filas.filter(function (u) { return u.usuario; }).map(function (u) {
    return { usuario: u.usuario, nombre: u.nombre, rol: normalizarRol_(u.rol), activo: u.activo };
  });
  return jsonOut_({ ok: true, usuarios: usuarios });
}

function handleCreateUsuario_(body) {
  requireAdmin_(body);
  var nombre = String(body.nuevoUsuario || '').trim().toUpperCase();
  var password = String(body.nuevaPassword || '');
  if (!nombre) throw new Error('El nombre de usuario es obligatorio.');
  if (!password) throw new Error('La contraseña inicial es obligatoria.');
  conLock_(['usuarios'], function () {
    if (usuarioPorNombre_(nombre)) throw new Error('Ya existe un usuario con ese nombre.');
    agregar_('Usuarios', {
      usuario: nombre, password: password, rol: normalizarRol_(body.rol),
      activo: body.activo !== false, nombre: texto_(body.nombre, 80)
    });
  });
  return jsonOut_({ ok: true });
}

function handleUpdateUsuario_(body) {
  requireAdmin_(body);
  var objetivo = String(body.targetUsuario || '').trim();
  if (!objetivo) throw new Error('Falta el usuario a editar.');
  var rol = normalizarRol_(body.rol);
  var activo = body.activo !== false;
  var nuevoNombre = String(body.nuevoUsuario || '').trim().toUpperCase();
  var nuevaPassword = String(body.nuevaPassword || '');

  var final = conLock_(['usuarios'], function () {
    var u = usuarioPorNombre_(objetivo);
    if (!u) throw new Error('El usuario ya no existe.');
    var eraAdminActivo = normalizarRol_(u.rol) === 'admin' && u.activo;
    if (eraAdminActivo && !(rol === 'admin' && activo) && contarAdminsActivos_() <= 1) {
      throw new Error('No puedes quitar el último Admin activo.');
    }
    var seRenombra = !!nuevoNombre && nuevoNombre !== u.usuario.toUpperCase();
    if (seRenombra && usuarioPorNombre_(nuevoNombre)) throw new Error('Ya existe un usuario con ese nombre.');
    if (seRenombra) u.usuario = nuevoNombre;
    u.rol = rol;
    u.activo = activo;
    u.nombre = texto_(body.nombre, 80);
    if (nuevaPassword) u.password = nuevaPassword;
    escribir_('Usuarios', u);
    return u.usuario;
  });
  return jsonOut_({ ok: true, usuario: final });
}

function handleDeleteUsuario_(body) {
  var actual = requireAdmin_(body);
  var objetivo = String(body.targetUsuario || '').trim();
  if (!objetivo) throw new Error('Falta el usuario a borrar.');
  if (objetivo.toUpperCase() === actual.usuario.toUpperCase()) throw new Error('No puedes borrarte a ti mismo.');
  conLock_(['usuarios'], function () {
    var u = usuarioPorNombre_(objetivo);
    if (!u) throw new Error('El usuario ya no existe.');
    if (normalizarRol_(u.rol) === 'admin' && u.activo && contarAdminsActivos_() <= 1) {
      throw new Error('No puedes borrar el último Admin activo.');
    }
    borrarFila_(hoja_('Usuarios'), u._fila);
  });
  return jsonOut_({ ok: true });
}

function handleCambiarMiPassword_(body) {
  var user = requireAuth_(body);
  var nuevaPassword = String(body.nuevaPassword || '');
  if (!nuevaPassword) throw new Error('La nueva contraseña es obligatoria.');
  conLock_([], function () {
    var u = usuarioPorNombre_(user.usuario);
    if (!u) throw new Error('El usuario ya no existe.');
    u.password = nuevaPassword;
    escribir_('Usuarios', u);
    invalidarAuth_(); // la contraseña vieja deja de valer ya, no cuando venza la caché
  });
  return jsonOut_({ ok: true });
}

function usuarioPorNombre_(nombre) {
  var buscado = String(nombre).trim().toUpperCase();
  var filas = leer_('Usuarios').filas;
  for (var i = 0; i < filas.length; i++) {
    if (filas[i].usuario.toUpperCase() === buscado) return filas[i];
  }
  return null;
}

function contarAdminsActivos_() {
  return leer_('Usuarios').filas.filter(function (u) { return normalizarRol_(u.rol) === 'admin' && u.activo; }).length;
}

/** { USUARIO: nombre completo } para mostrar quién hizo cada cosa. */
function mapaNombres_() {
  var mapa = {};
  leer_('Usuarios').filas.forEach(function (u) {
    if (u.usuario && u.nombre) mapa[u.usuario.toUpperCase()] = u.nombre;
  });
  return mapa;
}

function nombreDe_(nombres, usuario) {
  var u = String(usuario || '').trim();
  if (!u) return '';
  return nombres[u.toUpperCase()] || u;
}

// ---------- Catálogos simples ----------

function catalogo_(nombre) {
  var c = CATALOGOS[String(nombre || '')];
  if (!c) throw new Error('Catálogo desconocido.');
  return c;
}

function handleListCatalogo_(body) {
  requireAuth_(body);
  var c = catalogo_(body.tabla);
  var lista = leer_(c.hoja).filas.filter(function (r) { return r.id; }).map(limpiar_);
  // Los tamaños van por grupo (Calzado, Ropa…) y su orden propio: 36, 37… o S, M, L.
  lista.sort(c.hoja === 'Tamanos' ? compararTamanos_ : function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return jsonOut_({ ok: true, registros: lista });
}

function handleGuardarCatalogo_(body) {
  var c = catalogo_(body.tabla);
  if (c.soloAdmin) requireAdmin_(body); else requireEditor_(body);
  var datos = body.datos || {};
  var obj = {};
  Object.keys(c.campos).forEach(function (k) { obj[k] = texto_(datos[k], c.campos[k]); });
  obj.activo = datos.activo !== false;
  if (!obj.nombre) throw new Error('El nombre es obligatorio.');
  if (c.normalizar) c.normalizar(obj);
  var id = String(body.id || '').trim();
  var idFinal = id;

  conLock_([body.tabla], function () {
    var t = leer_(c.hoja);
    var repetido = t.filas.filter(function (r) {
      if (r.id === id || r.nombre.toUpperCase() !== obj.nombre.toUpperCase()) return false;
      // Un mismo nombre puede existir en grupos distintos (el 40 del calzado y el 40 de otra medida).
      return c.hoja !== 'Tamanos' || r.grupo.toUpperCase() === obj.grupo.toUpperCase();
    })[0];
    if (repetido) throw new Error('Ya existe ' + (c.femenino ? 'una ' : 'un ') + c.etiqueta + ' con ese nombre.');
    if (id) {
      var actual = buscar_(t, 'id', id);
      if (!actual) throw new Error((c.femenino ? 'La ' : 'El ') + c.etiqueta + ' ya no existe.');
      Object.keys(obj).forEach(function (k) { actual[k] = obj[k]; });
      escribir_(c.hoja, actual);
    } else {
      obj.id = nuevoId_();
      idFinal = obj.id;
      agregar_(c.hoja, obj);
    }
  });
  return jsonOut_({ ok: true, id: idFinal });
}

function handleBorrarCatalogo_(body) {
  var c = catalogo_(body.tabla);
  if (c.soloAdmin) requireAdmin_(body); else requireEditor_(body);
  var id = String(body.id || '').trim();
  conLock_([body.tabla], function () {
    var actual = buscar_(leer_(c.hoja), 'id', id);
    if (!actual) throw new Error((c.femenino ? 'La ' : 'El ') + c.etiqueta + ' ya no existe.');
    c.usadoEn.forEach(function (u) {
      if (buscar_(leer_(u.hoja), u.col, id)) {
        throw new Error('Está en uso en ' + u.hoja + '. Desactívalo en lugar de borrarlo.');
      }
    });
    borrarFila_(hoja_(c.hoja), actual._fila);
  });
  return jsonOut_({ ok: true });
}

/**
 * Pasos de una tabla de precios, guardados como JSON. Cada paso suma al costo un monto fijo en USD o
 * un porcentaje, sobre el costo original o sobre lo acumulado hasta ese paso. Devuelve el texto normalizado.
 */
function pasosPrecio_(texto) {
  var lista;
  try { lista = JSON.parse(texto || '[]'); } catch (e) { throw new Error('Los pasos de la tabla no son válidos.'); }
  if (!Array.isArray(lista) || !lista.length) throw new Error('La tabla necesita al menos un paso.');
  if (lista.length > 12) throw new Error('Una tabla admite hasta 12 pasos.');
  return JSON.stringify(lista.map(function (p) {
    var tipo = p && p.tipo === 'monto' ? 'monto' : 'porcentaje';
    var etiqueta = texto_(p && p.etiqueta, 60);
    if (!etiqueta) throw new Error('Cada paso necesita un nombre.');
    return {
      etiqueta: etiqueta, tipo: tipo,
      base: tipo === 'porcentaje' && p.base === 'acumulado' ? 'acumulado' : 'costo',
      valor: numero_(p && p.valor, 'El valor de «' + etiqueta + '»')
    };
  }));
}

// ---------- Productos ----------
// Un producto es un modelo con sus precios; los colores (ProductoColores) y los
// tamaños (ProductoTamanos) que tiene dan las variantes que se piden en un pedido.

function compararTamanos_(a, b) {
  if (a.grupo !== b.grupo) return a.grupo.localeCompare(b.grupo);
  if (a.orden !== b.orden) return a.orden - b.orden;
  return a.nombre.localeCompare(b.nombre);
}

/** { idTamaño: posición } según grupo y orden, para ordenar los tamaños de un producto. */
function posicionTamanos_() {
  var pos = {};
  leer_('Tamanos').filas.filter(function (t) { return t.id; }).sort(compararTamanos_)
    .forEach(function (t, i) { pos[t.id] = i; });
  return pos;
}

/** { productoId: [valores] } de una pestaña de variantes, en orden de alta. */
function variantesPorProducto_(hoja, col) {
  var m = {};
  leer_(hoja).filas.forEach(function (r) {
    if (r.productoId) (m[r.productoId] = m[r.productoId] || []).push(r[col]);
  });
  return m;
}

function handleListProductos_(body) {
  requireAuth_(body);
  // Fotos de cada producto: la general (sin color) y la de cada color; en cada grupo, la principal o la primera.
  var fotos = {};
  leer_('Archivos').filas.forEach(function (a) {
    if (a.entidad !== 'producto' || a.mime.indexOf('image/') !== 0) return;
    var grupo = fotos[a.entidadId] = fotos[a.entidadId] || {};
    if (!grupo[a.color] || a.principal) grupo[a.color] = a.driveId;
  });
  var colores = variantesPorProducto_('ProductoColores', 'color');
  var tamanos = variantesPorProducto_('ProductoTamanos', 'tamanoId');
  var pos = posicionTamanos_();
  var lista = leer_('Productos').filas.filter(function (p) { return p.id; }).map(function (p) {
    var x = limpiar_(p);
    var deProducto = fotos[p.id] || {};
    var porColor = {};
    Object.keys(deProducto).forEach(function (c) { if (c) porColor[c] = deProducto[c]; });
    x.fotosColor = porColor;
    // La foto general; si no hay, la de algún color (para que el producto siempre muestre una).
    x.fotoId = deProducto[''] || deProducto[Object.keys(porColor)[0]] || '';
    x.colores = colores[p.id] || [];
    x.tamanoIds = (tamanos[p.id] || []).slice().sort(function (a, b) { return (pos[a] || 0) - (pos[b] || 0); });
    return x;
  });
  lista.sort(function (a, b) { return a.codigo.localeCompare(b.codigo); });
  return jsonOut_({ ok: true, productos: lista });
}

/** Colores sin repetir (sin distinguir mayúsculas), recortados; como mucho 30. */
function listaColores_(valor) {
  var vistos = {};
  var lista = [];
  (Array.isArray(valor) ? valor : []).forEach(function (c) {
    var t = texto_(c, 40);
    if (t && !vistos[t.toUpperCase()]) { vistos[t.toUpperCase()] = true; lista.push(t); }
  });
  if (lista.length > 30) throw new Error('Un producto admite hasta 30 colores.');
  return lista;
}

/** Ids de tamaño sin repetir, todos existentes. */
function listaTamanos_(valor) {
  var existentes = {};
  leer_('Tamanos').filas.forEach(function (t) { existentes[t.id] = true; });
  var vistos = {};
  var lista = [];
  (Array.isArray(valor) ? valor : []).forEach(function (id) {
    var t = texto_(id, 40);
    if (!t || vistos[t]) return;
    if (!existentes[t]) throw new Error('Uno de los tamaños no existe.');
    vistos[t] = true;
    lista.push(t);
  });
  return lista;
}

/** Deja en `hoja` exactamente `valores` para el producto: borra los que sobran y agrega los nuevos. */
function sincronizarVariantes_(hoja, col, productoId, valores) {
  var sheet = hoja_(hoja);
  var actuales = leer_(hoja).filas.filter(function (r) { return r.productoId === productoId; });
  var clave = function (v) { return String(v).toUpperCase(); };
  var quedan = {};
  valores.forEach(function (v) { quedan[clave(v)] = true; });
  var existen = {};
  actuales.forEach(function (r) { existen[clave(r[col])] = true; });
  actuales.sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (r) { if (!quedan[clave(r[col])]) borrarFila_(sheet, r._fila); });
  valores.forEach(function (v) {
    if (existen[clave(v)]) return;
    var fila = { id: nuevoId_(), productoId: productoId };
    fila[col] = v;
    agregar_(hoja, fila);
  });
}

function handleGuardarProducto_(body) {
  requireEditor_(body);
  var d = body.datos || {};
  var obj = {
    codigo: texto_(d.codigo, 40),
    descripcion: texto_(d.descripcion, 300),
    marcaId: texto_(d.marcaId, 40),
    proveedorId: texto_(d.proveedorId, 40),
    precioCosto: numero_(d.precioCosto, 'El precio de costo'),
    precioVentaUsd: numero_(d.precioVentaUsd, 'El precio de venta en USD'),
    precioVentaGs: Math.round(numero_(d.precioVentaGs, 'El precio de venta en Gs')),
    activo: d.activo !== false,
    tablaPrecioId: texto_(d.tablaPrecioId, 40)
  };
  if (!obj.codigo) throw new Error('El código es obligatorio.');
  if (!obj.descripcion) throw new Error('La descripción es obligatoria.');
  validarReferencia_('Marcas', obj.marcaId, 'La marca');
  validarReferencia_('Proveedores', obj.proveedorId, 'El proveedor');
  validarReferencia_('TablasPrecio', obj.tablaPrecioId, 'La tabla de precios');
  var colores = listaColores_(d.colores);
  var tamanoIds = listaTamanos_(d.tamanoIds);
  var id = String(body.id || '').trim();

  var final = conLock_(['productos', 'archivos'], function () {
    var t = leer_('Productos');
    var repetido = t.filas.filter(function (p) {
      return p.id !== id && p.codigo.toUpperCase() === obj.codigo.toUpperCase();
    })[0];
    if (repetido) throw new Error('Ya existe un producto con el código ' + obj.codigo + '.');
    var productoId = id;
    if (id) {
      var actual = buscar_(t, 'id', id);
      if (!actual) throw new Error('El producto ya no existe.');
      Object.keys(obj).forEach(function (k) { actual[k] = obj[k]; });
      escribir_('Productos', actual);
    } else {
      productoId = obj.id = nuevoId_();
      agregar_('Productos', obj);
    }
    sincronizarVariantes_('ProductoColores', 'color', productoId, colores);
    sincronizarVariantes_('ProductoTamanos', 'tamanoId', productoId, tamanoIds);
    reubicarFotosColor_(productoId);
    return productoId;
  });
  return jsonOut_({ ok: true, id: final });
}

/**
 * Las fotos de un color que el producto ya no tiene pasan a ser generales (sin color), para que no queden
 * huérfanas; si solo cambió la mayúscula del nombre, siguen con su color. Cuida que haya una sola principal general.
 */
function reubicarFotosColor_(productoId) {
  var vigentes = {};
  (variantesPorProducto_('ProductoColores', 'color')[productoId] || []).forEach(function (c) { vigentes[c.toUpperCase()] = c; });
  var fotos = leer_('Archivos').filas.filter(function (a) { return a.entidad === 'producto' && a.entidadId === productoId && a.color; });
  var hayPrincipalGeneral = leer_('Archivos').filas.some(function (a) {
    return a.entidad === 'producto' && a.entidadId === productoId && !a.color && a.principal;
  });
  fotos.forEach(function (a) {
    var actual = vigentes[a.color.toUpperCase()];
    if (actual === a.color) return;
    if (actual) {
      a.color = actual;
    } else {
      a.color = '';
      if (a.principal) {
        if (hayPrincipalGeneral) a.principal = false;
        else hayPrincipalGeneral = true;
      }
    }
    escribir_('Archivos', a);
  });
}

function handleBorrarProducto_(body) {
  requireEditor_(body);
  var id = String(body.id || '').trim();
  conLock_(['productos', 'archivos'], function () {
    var p = buscar_(leer_('Productos'), 'id', id);
    if (!p) throw new Error('El producto ya no existe.');
    if (buscar_(leer_('PedidoLineas'), 'productoId', id)) {
      throw new Error('El producto está en pedidos. Desactívalo en lugar de borrarlo.');
    }
    borrarDonde_('ProductoColores', 'productoId', id);
    borrarDonde_('ProductoTamanos', 'productoId', id);
    borrarArchivosDe_('producto', id);
    borrarFila_(hoja_('Productos'), p._fila);
  });
  return jsonOut_({ ok: true });
}

// ---------- Pedidos ----------

function handleListPedidos_(body) {
  requireAuth_(body);
  var nombres = mapaNombres_();
  var cargado = cargadoPorLinea_();
  var asignado = asignadoPorLinea_();
  var lineasPorPedido = {};
  leer_('PedidoLineas').filas.forEach(function (l) {
    if (!l.id) return;
    var x = limpiar_(l);
    x.cargado = cargado[l.id] || 0;
    x.asignado = asignado[l.id] || 0;
    (lineasPorPedido[l.pedidoId] = lineasPorPedido[l.pedidoId] || []).push(x);
  });
  var lista = leer_('Pedidos').filas.filter(function (p) { return p.id; }).map(function (p) {
    var x = limpiar_(p);
    x.estado = normalizarEstadoPedido_(p.estado);
    x.creadoNombre = nombreDe_(nombres, p.creadoPor);
    x.lineas = lineasPorPedido[p.id] || [];
    x.cargos = leerCargos_(p.cargos);
    return x;
  });
  // Más recientes primero.
  lista.sort(function (a, b) { return String(b.folio).localeCompare(String(a.folio)); });
  return jsonOut_({ ok: true, pedidos: lista });
}

/**
 * Alta o edición de un pedido con sus líneas. Las líneas llegan completas:
 * las que traen id se actualizan, las nuevas se agregan con una copia de los
 * datos del producto, y las que faltan se borran (si no están cargadas en un
 * contenedor). Una línea cargada no puede quedar con menos cantidad que la cargada.
 */
function handleGuardarPedido_(body) {
  var user = requireEditor_(body);
  var proveedorId = texto_(body.proveedorId, 40);
  var fechaPedido = texto_(body.fechaPedido, 10);
  if (!proveedorId) throw new Error('El proveedor es obligatorio.');
  validarReferencia_('Proveedores', proveedorId, 'El proveedor');
  if (!fechaValida_(fechaPedido)) throw new Error('La fecha del pedido no es válida.');
  var lineasIn = Array.isArray(body.lineas) ? body.lineas : [];
  if (!lineasIn.length) throw new Error('El pedido debe tener al menos un producto con cantidad.');
  var id = String(body.id || '').trim();
  var ajustes = ajustesCosto_(body);

  var resultado = conLock_(['pedidos', 'historial', 'cambiosPrecio'], function () {
    var tP = leer_('Pedidos');
    var pedido;
    if (id) {
      pedido = buscar_(tP, 'id', id);
      if (!pedido) throw new Error('El pedido ya no existe.');
      if (pedido.estado === 'cancelado' || pedido.estado === 'entregado') {
        throw new Error('No se puede modificar un pedido ' + pedido.estado + '.');
      }
      pedido.proveedorId = proveedorId;
      pedido.fechaPedido = fechaPedido;
      pedido.notas = texto_(body.notas, 2000);
      pedido.descuentoTipo = ajustes.descuentoTipo;
      pedido.descuentoValor = ajustes.descuentoValor;
      pedido.descuentoMotivo = ajustes.descuentoMotivo;
      pedido.cargos = ajustes.cargos;
      escribir_('Pedidos', pedido);
    } else {
      // El pedido nace «registrado» en la fecha en que se hizo (no después de hoy).
      var desde = fechaPedido > hoy_() ? hoy_() : fechaPedido;
      pedido = {
        id: nuevoId_(), folio: siguienteFolio_(tP), proveedorId: proveedorId, clienteId: '',
        estado: 'registrado', fechaPedido: fechaPedido, notas: texto_(body.notas, 2000),
        creadoPor: user.usuario, fechaCreacion: new Date().toISOString(), fechaEstado: desde,
        descuentoTipo: ajustes.descuentoTipo, descuentoValor: ajustes.descuentoValor,
        descuentoMotivo: ajustes.descuentoMotivo, cargos: ajustes.cargos
      };
      agregar_('Pedidos', pedido);
      agregarHistorial_('pedido', pedido.id, 'registrado', desde, user.usuario, '');
    }
    guardarLineas_(pedido.id, lineasIn, user.usuario);
    return { id: pedido.id, folio: pedido.folio };
  });
  return jsonOut_({ ok: true, id: resultado.id, folio: resultado.folio });
}

/** Cargos adicionales guardados como JSON en una celda; vuelve a lista (vacía si el texto no sirve). */
function leerCargos_(v) {
  if (!v) return [];
  try {
    var l = JSON.parse(v);
    return Array.isArray(l) ? l : [];
  } catch (e) {
    return [];
  }
}

/** Descuento sobre el total y cargos adicionales del pedido a fábrica, validados; los cargos quedan como texto JSON. */
function ajustesCosto_(body) {
  var tipo = texto_(body.descuentoTipo, 12);
  if (tipo !== 'porcentaje' && tipo !== 'monto') tipo = '';
  var valor = tipo ? numero_(body.descuentoValor, 'El descuento') : 0;
  if (tipo === 'porcentaje' && valor > 100) throw new Error('El descuento no puede pasar de 100%.');
  if (!valor) tipo = '';
  var cargos = (Array.isArray(body.cargos) ? body.cargos : []).slice(0, 20).map(function (c) {
    return { concepto: texto_(c && c.concepto, 80), monto: numero_(c && c.monto, 'El monto del cargo') };
  }).filter(function (c) { return c.concepto || c.monto; });
  cargos.forEach(function (c) { if (!c.concepto) throw new Error('Indica el concepto de cada cargo adicional.'); });
  return {
    descuentoTipo: tipo, descuentoValor: valor,
    descuentoMotivo: tipo ? texto_(body.descuentoMotivo, 120) : '',
    cargos: cargos.length ? JSON.stringify(cargos) : ''
  };
}

/** Líneas de un pedido a fábrica: no se pueden bajar de lo cargado en contenedores ni de lo asignado a clientes. */
function guardarLineas_(pedidoId, lineasIn, usuario) {
  guardarLineasDe_({
    hoja: 'PedidoLineas', dueno: 'pedidoId', duenoId: pedidoId, conCosto: true,
    entidad: 'pedido', usuario: usuario,
    comprometidos: [
      { mapa: cargadoPorLinea_(), texto: 'cargados en contenedores' },
      { mapa: asignadoPorLinea_(), texto: 'asignados a clientes' }
    ]
  }, lineasIn);
}

/**
 * Líneas de un pedido de cliente. Si se baja o se quita algo ya asignado desde pedidos a
 * fábrica, esa parte se libera y vuelve a ser stock del pedido a fábrica.
 */
function guardarLineasCliente_(pcId, lineasIn, usuario) {
  guardarLineasDe_({
    hoja: 'PCLineas', dueno: 'pcId', duenoId: pcId, conCosto: false,
    entidad: 'pedidoCliente', usuario: usuario,
    comprometidos: [],
    liberar: liberarAsignacionesPc_
  }, lineasIn);
}

/** Deja asignadas a una línea de pedido de cliente como máximo `maximo` unidades (libera las últimas). */
function liberarAsignacionesPc_(pcLineaId, maximo) {
  var filas = leer_('Asignaciones').filas.filter(function (a) { return a.pcLineaId === pcLineaId; })
    .sort(function (a, b) { return b._fila - a._fila; });
  var exceso = filas.reduce(function (t, a) { return t + Number(a.cantidad || 0); }, 0) - maximo;
  var borrar = [];
  filas.forEach(function (a) {
    if (exceso <= 0) return;
    var n = Number(a.cantidad || 0);
    if (n <= exceso) {
      borrar.push(a);
      exceso -= n;
    } else {
      a.cantidad = n - exceso;
      escribir_('Asignaciones', a);
      exceso = 0;
    }
  });
  var sheet = hoja_('Asignaciones');
  borrar.sort(function (a, b) { return b._fila - a._fila; }).forEach(function (a) { borrarFila_(sheet, a._fila); });
}

/**
 * Guarda las líneas de un pedido (a fábrica o de cliente), una por producto, color y
 * tamaño. `cfg`: { hoja, dueno (columna con el id del pedido), duenoId, conCosto,
 * comprometidos: [{ mapa lineaId→cantidad, texto }] }. Una línea existente conserva su
 * color y tamaño; con curva (porCaja × cajas) la cantidad se calcula.
 */
function guardarLineasDe_(cfg, lineasIn) {
  var tL = leer_(cfg.hoja);
  var productos = leer_('Productos');
  var marcas = mapaNombresCatalogo_('Marcas');
  var tamanos = mapaNombresCatalogo_('Tamanos');
  var coloresPor = variantesPorProducto_('ProductoColores', 'color');
  var tamanosPor = variantesPorProducto_('ProductoTamanos', 'tamanoId');
  var existentes = tL.filas.filter(function (l) { return l[cfg.dueno] === cfg.duenoId; });
  var vistos = {};
  var cambios = {}; // cambios de precio de líneas existentes, uno por producto y campo
  var variantes = {}; // producto|color|tamaño: no puede repetirse dentro del pedido
  var claveVariante = function (productoId, color, tamanoId) {
    return productoId + '|' + String(color).toUpperCase() + '|' + tamanoId;
  };
  var registrar = function (codigo, clave) {
    if (variantes[clave]) throw new Error(codigo + ': esa combinación de color y tamaño está repetida.');
    variantes[clave] = true;
  };
  var verificar = function (l, cantidad, quitando) {
    // Si el pedido sabe liberar lo comprometido (los de cliente), se libera en vez de rechazar.
    if (cfg.liberar) {
      cfg.liberar(l.id, quitando ? 0 : cantidad);
      return;
    }
    cfg.comprometidos.forEach(function (c) {
      var n = c.mapa[l.id] || 0;
      var etiqueta = [l.codigo, l.color, l.tamano].filter(String).join(' ');
      if (quitando && n > 0) throw new Error('No se puede quitar ' + etiqueta + ': tiene ' + n + ' ' + c.texto + '.');
      if (!quitando && cantidad < n) throw new Error(etiqueta + ': ya tiene ' + n + ' ' + c.texto + '.');
    });
  };

  lineasIn.forEach(function (li) {
    var cantidad = numero_(li.cantidad, 'La cantidad');
    // Con curva: unidades por caja de este tamaño × cajas de este color; la cantidad sale de ahí.
    var porCaja = numero_(li.porCaja, 'Las unidades por caja');
    var cajas = numero_(li.cajas, 'Las cajas');
    if (porCaja > 0 && cajas > 0) cantidad = Math.round(porCaja * cajas * 1000) / 1000;
    else { porCaja = 0; cajas = 0; }
    if (!(cantidad > 0)) throw new Error('Cada línea debe tener una cantidad mayor que cero.');
    var precios = {
      precioVentaUsd: numero_(li.precioVentaUsd, 'El precio de venta en USD'),
      precioVentaGs: Math.round(numero_(li.precioVentaGs, 'El precio de venta en Gs'))
    };
    if (cfg.conCosto) precios.precioCosto = numero_(li.precioCosto, 'El precio de costo');
    var lid = String(li.id || '').trim();
    var actual = lid ? existentes.filter(function (l) { return l.id === lid; })[0] : null;
    if (actual) {
      vistos[lid] = true;
      registrar(actual.codigo, claveVariante(actual.productoId, actual.color, actual.tamanoId));
      verificar(actual, cantidad, false);
      anotarCambiosPrecio_(cfg, actual, precios, cambios);
      actual.cantidad = cantidad;
      actual.porCaja = porCaja;
      actual.cajas = cajas;
      Object.keys(precios).forEach(function (k) { actual[k] = precios[k]; });
      escribir_(cfg.hoja, actual);
      return;
    }
    var prod = buscar_(productos, 'id', String(li.productoId || ''));
    if (!prod) throw new Error('Uno de los productos ya no existe.');
    var colores = coloresPor[prod.id] || [];
    var tamanoIds = tamanosPor[prod.id] || [];
    var color = texto_(li.color, 40);
    var tamanoId = texto_(li.tamanoId, 40);
    if (colores.length) {
      var igual = colores.filter(function (c) { return c.toUpperCase() === color.toUpperCase(); })[0];
      if (!igual) throw new Error(prod.codigo + ': elige un color válido.');
      color = igual;
    } else {
      color = '';
    }
    if (tamanoIds.length) {
      if (tamanoIds.indexOf(tamanoId) === -1) throw new Error(prod.codigo + ': elige un tamaño válido.');
    } else {
      tamanoId = '';
    }
    registrar(prod.codigo, claveVariante(prod.id, color, tamanoId));
    var nueva = {
      id: nuevoId_(), productoId: prod.id, codigo: prod.codigo,
      descripcion: prod.descripcion, color: color, marca: marcas[prod.marcaId] || '',
      tamano: tamanos[tamanoId] || '', tamanoId: tamanoId, cantidad: cantidad,
      porCaja: porCaja, cajas: cajas
    };
    nueva[cfg.dueno] = cfg.duenoId;
    Object.keys(precios).forEach(function (k) { nueva[k] = precios[k]; });
    agregar_(cfg.hoja, nueva);
  });

  // Las que no vinieron se borran (de abajo hacia arriba para no correr los índices).
  var sheet = hoja_(cfg.hoja);
  existentes.filter(function (l) { return !vistos[l.id]; })
    .sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (l) {
      verificar(l, 0, true);
      borrarFila_(sheet, l._fila);
    });
  Object.keys(cambios).forEach(function (k) { agregar_('CambiosPrecio', cambios[k]); });
}

/**
 * Un pedido conserva los precios con que se cargó. Si se modifican, el cambio queda registrado con el
 * precio anterior (y quién y cuándo). Las líneas de un mismo producto con el mismo cambio se anotan una vez.
 */
function anotarCambiosPrecio_(cfg, actual, precios, cambios) {
  Object.keys(precios).forEach(function (campo) {
    var antes = Number(actual[campo]) || 0;
    var ahora = Number(precios[campo]) || 0;
    if (antes === ahora) return;
    var clave = actual.productoId + '|' + campo + '|' + antes + '|' + ahora;
    if (cambios[clave]) return;
    cambios[clave] = {
      id: nuevoId_(), entidad: cfg.entidad, entidadId: cfg.duenoId, productoId: actual.productoId,
      codigo: actual.codigo, descripcion: actual.descripcion, campo: campo, anterior: antes, nuevo: ahora,
      usuario: cfg.usuario, cuando: new Date().toISOString()
    };
  });
}

function handleListCambiosPrecio_(body) {
  requireAuth_(body);
  var entidad = String(body.entidad || '');
  var entidadId = String(body.entidadId || '');
  var nombres = mapaNombres_();
  var lista = leer_('CambiosPrecio').filas.filter(function (c) { return c.id && c.entidad === entidad && c.entidadId === entidadId; })
    .map(function (c) {
      var x = limpiar_(c);
      x.usuarioNombre = nombreDe_(nombres, c.usuario);
      return x;
    });
  return jsonOut_({ ok: true, cambios: lista });
}

function borrarCambiosPrecio_(entidad, entidadId) {
  var sheet = hoja_('CambiosPrecio');
  leer_('CambiosPrecio').filas.filter(function (c) { return c.entidad === entidad && c.entidadId === entidadId; })
    .sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (c) { borrarFila_(sheet, c._fila); });
}

/** Cantidad asignada a clientes, por línea de pedido a fábrica. */
function asignadoPorLinea_() {
  var m = {};
  leer_('Asignaciones').filas.forEach(function (a) { m[a.lineaId] = (m[a.lineaId] || 0) + Number(a.cantidad || 0); });
  return m;
}

/** Cantidad ya cubierta desde pedidos a fábrica, por línea de pedido de cliente. */
function asignadoPorPcLinea_() {
  var m = {};
  leer_('Asignaciones').filas.forEach(function (a) { m[a.pcLineaId] = (m[a.pcLineaId] || 0) + Number(a.cantidad || 0); });
  return m;
}

/** Devuelve el siguiente folio 'PED-0001' (o con otro prefijo, p. ej. 'PC'). */
function siguienteFolio_(tabla, prefijo) {
  var max = 0;
  tabla.filas.forEach(function (p) {
    var n = parseInt(String(p.folio).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return (prefijo || 'PED') + '-' + ('000' + (max + 1)).slice(-Math.max(4, String(max + 1).length));
}

/** Cambio manual de estado (registrado…fabricado, entregado, cancelado). */
function handleCambiarEstadoPedido_(body) {
  var user = requireEditor_(body);
  var estado = String(body.estado || '');
  if (MANUALES_PEDIDO.indexOf(estado) === -1) throw new Error('Ese estado lo ponen los contenedores.');
  var fecha = fechaCambio_(body.fecha);
  var nota = texto_(body.nota, 500);

  conLock_(['pedidos', 'historial', 'pedidosCliente'], function () {
    var p = buscar_(leer_('Pedidos'), 'id', String(body.id || ''));
    if (!p) throw new Error('El pedido ya no existe.');
    var actual = normalizarEstadoPedido_(p.estado);
    if (actual === estado) throw new Error('El pedido ya está en ese estado.');
    validarFechaSecuencia_('pedido', p.id, fecha);
    var conCargas = !!buscar_(leer_('Cargas'), 'pedidoId', p.id);
    var viajando = ordenPedido_(actual) >= ordenPedido_('embarcado') && actual !== 'cancelado';

    if (estado === 'entregado') {
      if (actual !== 'desembarcado') throw new Error('Solo se entrega un pedido desembarcado.');
    } else if (estado === 'cancelado') {
      if (conCargas) throw new Error('El pedido está cargado en un contenedor: quítalo antes de cancelarlo.');
    } else if (viajando) {
      throw new Error('El pedido ya está embarcado: su estado lo dan los contenedores.');
    }
    p.estado = estado;
    p.fechaEstado = fecha;
    escribir_('Pedidos', p);
    agregarHistorial_('pedido', p.id, estado, fecha, user.usuario, nota);
    // Un pedido cancelado ya no puede abastecer a nadie: lo asignado a clientes vuelve a quedar pendiente.
    if (estado === 'cancelado') {
      var propias = {};
      leer_('PedidoLineas').filas.forEach(function (l) { if (l.pedidoId === p.id) propias[l.id] = true; });
      borrarAsignacionesDonde_(function (a) { return propias[a.lineaId]; });
    }
  });
  return jsonOut_({ ok: true });
}

/** Solo el admin, y solo pedidos cancelados. Se lleva líneas, historial y archivos. */
function handleBorrarPedido_(body) {
  requireAdmin_(body);
  var id = String(body.id || '').trim();
  conLock_(['pedidos', 'historial', 'archivos', 'cambiosPrecio'], function () {
    var p = buscar_(leer_('Pedidos'), 'id', id);
    if (!p) throw new Error('El pedido ya no existe.');
    if (p.estado !== 'cancelado') throw new Error('Solo se puede borrar un pedido cancelado. Cancélalo primero.');
    borrarDonde_('PedidoLineas', 'pedidoId', id);
    borrarHistorial_('pedido', id);
    borrarCambiosPrecio_('pedido', id);
    borrarArchivosDe_('pedido', id);
    borrarFila_(hoja_('Pedidos'), p._fila);
  });
  return jsonOut_({ ok: true });
}

// ---------- Pedidos de cliente ----------
// Un pedido de cliente guarda lo que pidió el cliente (producto, color, tamaño, cantidad y su
// precio de venta). Se cubre asignándole cantidades de líneas de pedidos a fábrica de la misma
// variante (Asignaciones): ya sea porque la fábrica ya tiene el pedido o porque se pide después.
// Lo que de un pedido a fábrica no se asigna a nadie es stock propio.

function borrarAsignacionesDonde_(condicion) {
  var sheet = hoja_('Asignaciones');
  leer_('Asignaciones').filas.filter(condicion)
    .sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (a) { borrarFila_(sheet, a._fila); });
}

function handleListPedidosCliente_(body) {
  requireAuth_(body);
  var nombres = mapaNombres_();
  var pedidoDeLinea = {};
  leer_('PedidoLineas').filas.forEach(function (l) { pedidoDeLinea[l.id] = l.pedidoId; });
  var asigPor = {};
  leer_('Asignaciones').filas.forEach(function (a) {
    if (!a.id) return;
    (asigPor[a.pcLineaId] = asigPor[a.pcLineaId] || []).push({
      lineaId: a.lineaId, pedidoId: pedidoDeLinea[a.lineaId] || '', cantidad: a.cantidad
    });
  });
  var lineasPor = {};
  leer_('PCLineas').filas.forEach(function (l) {
    if (!l.id) return;
    var x = limpiar_(l);
    x.asignaciones = asigPor[l.id] || [];
    x.asignado = x.asignaciones.reduce(function (sum, a) { return sum + a.cantidad; }, 0);
    (lineasPor[l.pcId] = lineasPor[l.pcId] || []).push(x);
  });
  var lista = leer_('PedidosCliente').filas.filter(function (p) { return p.id; }).map(function (p) {
    var x = limpiar_(p);
    x.estado = ESTADOS_PC.indexOf(p.estado) === -1 ? 'registrado' : p.estado;
    x.creadoNombre = nombreDe_(nombres, p.creadoPor);
    x.lineas = lineasPor[p.id] || [];
    return x;
  });
  lista.sort(function (a, b) { return String(b.folio).localeCompare(String(a.folio)); });
  return jsonOut_({ ok: true, pedidosCliente: lista });
}

/**
 * Alta o edición de un pedido de cliente con sus líneas (misma lógica que el pedido a
 * fábrica, con precios de venta). Con `asignar: true` al terminar se asigna lo disponible.
 */
function handleGuardarPedidoCliente_(body) {
  var user = requireEditor_(body);
  var clienteId = texto_(body.clienteId, 40);
  var fecha = texto_(body.fecha, 10);
  if (!clienteId) throw new Error('El cliente es obligatorio.');
  validarReferencia_('Clientes', clienteId, 'El cliente');
  if (!fechaValida_(fecha)) throw new Error('La fecha del pedido no es válida.');
  var lineasIn = Array.isArray(body.lineas) ? body.lineas : [];
  if (!lineasIn.length) throw new Error('El pedido debe tener al menos un producto con cantidad.');
  var id = String(body.id || '').trim();

  var resultado = conLock_(['pedidosCliente', 'historial', 'pedidos', 'cambiosPrecio'], function () {
    var tP = leer_('PedidosCliente');
    var pc;
    if (id) {
      pc = buscar_(tP, 'id', id);
      if (!pc) throw new Error('El pedido ya no existe.');
      if (pc.estado === 'cancelado' || pc.estado === 'entregado') throw new Error('No se puede modificar un pedido ' + pc.estado + '.');
      pc.clienteId = clienteId;
      pc.fecha = fecha;
      pc.notas = texto_(body.notas, 2000);
      escribir_('PedidosCliente', pc);
    } else {
      var desde = fecha > hoy_() ? hoy_() : fecha;
      pc = {
        id: nuevoId_(), folio: siguienteFolio_(tP, 'PC'), clienteId: clienteId, estado: 'registrado',
        fecha: fecha, notas: texto_(body.notas, 2000), creadoPor: user.usuario,
        fechaCreacion: new Date().toISOString(), fechaEstado: desde
      };
      agregar_('PedidosCliente', pc);
      agregarHistorial_('pedidoCliente', pc.id, 'registrado', desde, user.usuario, '');
    }
    guardarLineasCliente_(pc.id, lineasIn, user.usuario);
    var asignado = 0;
    if (body.asignar === true) asignado = asignarDisponible_([pc.id]);
    return { id: pc.id, folio: pc.folio, asignado: asignado };
  });
  return jsonOut_({ ok: true, id: resultado.id, folio: resultado.folio, asignado: resultado.asignado });
}

/** Sube una revisión tomando el lock (para cambios que ya se hicieron dentro de otro bloque). */
function bumpRevisionTras_(revs) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { revs.forEach(bumpRevision_); } finally { lock.releaseLock(); }
}

/**
 * Asigna a los pedidos de cliente indicados todo lo que se pueda de lo que les falta,
 * desde líneas de pedidos a fábrica de la misma variante (producto, color y tamaño), de
 * los más antiguos a los más nuevos. Se debe llamar con el lock tomado. Devuelve las unidades asignadas.
 */
function asignarDisponible_(pcIds) {
  var pedidos = {};
  leer_('Pedidos').filas.forEach(function (p) { pedidos[p.id] = p; });
  var lineasFab = leer_('PedidoLineas').filas.filter(function (l) { return pedidos[l.pedidoId] && pedidos[l.pedidoId].estado !== 'cancelado'; });
  var libre = {};
  var asignadoFab = asignadoPorLinea_();
  lineasFab.forEach(function (l) { libre[l.id] = Number(l.cantidad) - (asignadoFab[l.id] || 0); });
  lineasFab.sort(function (a, b) {
    var pa = pedidos[a.pedidoId], pb = pedidos[b.pedidoId];
    return (pa.fechaPedido + pa.folio).localeCompare(pb.fechaPedido + pb.folio);
  });
  var tAsig = leer_('Asignaciones');
  var cubierto = asignadoPorPcLinea_();
  var total = 0;

  pcIds.forEach(function (pcId) {
    leer_('PCLineas').filas.filter(function (l) { return l.pcId === pcId; }).forEach(function (pl) {
      var falta = Number(pl.cantidad) - (cubierto[pl.id] || 0);
      lineasFab.forEach(function (fl) {
        if (falta <= 0 || libre[fl.id] <= 0) return;
        if (fl.productoId !== pl.productoId || fl.tamanoId !== pl.tamanoId || fl.color.toUpperCase() !== pl.color.toUpperCase()) return;
        var n = Math.min(falta, libre[fl.id]);
        var previa = tAsig.filas.filter(function (a) { return a.pcLineaId === pl.id && a.lineaId === fl.id; })[0];
        if (previa) {
          previa.cantidad = Number(previa.cantidad) + n;
          escribir_('Asignaciones', previa);
        } else {
          var nueva = { id: nuevoId_(), pcLineaId: pl.id, lineaId: fl.id, cantidad: n };
          agregar_('Asignaciones', nueva);
          tAsig.filas.push(nueva);
        }
        libre[fl.id] -= n;
        falta -= n;
        cubierto[pl.id] = (cubierto[pl.id] || 0) + n;
        total += n;
      });
    });
  });
  return total;
}

/** Asigna a mano: reemplaza todas las asignaciones del pedido de cliente por las indicadas [{ pcLineaId, lineaId, cantidad }]. */
function handleAsignarPedidoCliente_(body) {
  requireEditor_(body);
  var pcId = String(body.pcId || '').trim();
  var entrada = Array.isArray(body.asignaciones) ? body.asignaciones : [];

  conLock_(['pedidosCliente', 'pedidos'], function () {
    var pc = buscar_(leer_('PedidosCliente'), 'id', pcId);
    if (!pc) throw new Error('El pedido ya no existe.');
    if (pc.estado !== 'registrado') throw new Error('Solo se asigna a un pedido de cliente registrado.');
    var lineasPc = leer_('PCLineas').filas.filter(function (l) { return l.pcId === pcId; });
    var propias = {};
    lineasPc.forEach(function (l) { propias[l.id] = l; });
    var pedidos = leer_('Pedidos');
    var lineasFab = leer_('PedidoLineas');
    // Lo asignado a OTROS pedidos de cliente, por línea de fábrica.
    var otros = {};
    leer_('Asignaciones').filas.forEach(function (a) {
      if (!propias[a.pcLineaId]) otros[a.lineaId] = (otros[a.lineaId] || 0) + Number(a.cantidad || 0);
    });

    var nuevas = [];
    var porPc = {}, porFab = {};
    entrada.forEach(function (e) {
      var n = numero_(e.cantidad, 'La cantidad');
      if (!(n > 0)) return;
      var pl = propias[String(e.pcLineaId || '')];
      if (!pl) throw new Error('Una de las líneas del pedido de cliente ya no existe.');
      var fl = buscar_(lineasFab, 'id', String(e.lineaId || ''));
      if (!fl) throw new Error('Una de las líneas del pedido a fábrica ya no existe.');
      var ped = buscar_(pedidos, 'id', fl.pedidoId);
      if (!ped || ped.estado === 'cancelado') throw new Error('No se puede asignar desde un pedido a fábrica cancelado.');
      if (fl.productoId !== pl.productoId || fl.tamanoId !== pl.tamanoId || fl.color.toUpperCase() !== pl.color.toUpperCase()) {
        throw new Error(pl.codigo + ': el producto, color y tamaño deben coincidir con el pedido a fábrica.');
      }
      porPc[pl.id] = (porPc[pl.id] || 0) + n;
      if (porPc[pl.id] > Number(pl.cantidad)) throw new Error(pl.codigo + ' ' + pl.color + ' ' + pl.tamano + ': se asignaría más de lo que pidió el cliente (' + pl.cantidad + ').');
      porFab[fl.id] = (porFab[fl.id] || 0) + n;
      if (porFab[fl.id] + (otros[fl.id] || 0) > Number(fl.cantidad)) {
        throw new Error(ped.folio + ' / ' + fl.codigo + ' ' + fl.color + ' ' + fl.tamano + ': no alcanza lo disponible.');
      }
      nuevas.push({ id: nuevoId_(), pcLineaId: pl.id, lineaId: fl.id, cantidad: n });
    });

    borrarAsignacionesDonde_(function (a) { return propias[a.pcLineaId]; });
    nuevas.forEach(function (n) { agregar_('Asignaciones', n); });
  });
  return jsonOut_({ ok: true });
}

/** Asigna lo disponible a un pedido de cliente (`pcId`) o a todos los registrados (sin `pcId`). */
function handleAsignarAutomatico_(body) {
  requireEditor_(body);
  var pcId = String(body.pcId || '').trim();
  var asignado = conLock_(['pedidosCliente', 'pedidos'], function () {
    var tP = leer_('PedidosCliente').filas.filter(function (p) { return p.id && p.estado === 'registrado'; });
    if (pcId) {
      tP = tP.filter(function (p) { return p.id === pcId; });
      if (!tP.length) throw new Error('El pedido no existe o no está registrado.');
    }
    tP.sort(function (a, b) { return String(a.fechaCreacion).localeCompare(String(b.fechaCreacion)); });
    return asignarDisponible_(tP.map(function (p) { return p.id; }));
  });
  return jsonOut_({ ok: true, asignado: asignado });
}

function handleCambiarEstadoPedidoCliente_(body) {
  var user = requireEditor_(body);
  var estado = String(body.estado || '');
  if (ESTADOS_PC.indexOf(estado) === -1) throw new Error('Estado no válido.');
  var fecha = fechaCambio_(body.fecha);
  var nota = texto_(body.nota, 500);
  conLock_(['pedidosCliente', 'historial', 'pedidos'], function () {
    var pc = buscar_(leer_('PedidosCliente'), 'id', String(body.id || ''));
    if (!pc) throw new Error('El pedido ya no existe.');
    if (pc.estado === estado) throw new Error('El pedido ya está en ese estado.');
    validarFechaSecuencia_('pedidoCliente', pc.id, fecha);
    pc.estado = estado;
    pc.fechaEstado = fecha;
    escribir_('PedidosCliente', pc);
    agregarHistorial_('pedidoCliente', pc.id, estado, fecha, user.usuario, nota);
    // Cancelado: lo asignado vuelve a estar disponible para otros.
    if (estado === 'cancelado') {
      var propias = {};
      leer_('PCLineas').filas.forEach(function (l) { if (l.pcId === pc.id) propias[l.id] = true; });
      borrarAsignacionesDonde_(function (a) { return propias[a.pcLineaId]; });
    }
  });
  return jsonOut_({ ok: true });
}

/** Solo el admin, y solo pedidos de cliente cancelados. */
function handleBorrarPedidoCliente_(body) {
  requireAdmin_(body);
  var id = String(body.id || '').trim();
  conLock_(['pedidosCliente', 'historial', 'cambiosPrecio'], function () {
    var pc = buscar_(leer_('PedidosCliente'), 'id', id);
    if (!pc) throw new Error('El pedido ya no existe.');
    if (pc.estado !== 'cancelado') throw new Error('Solo se puede borrar un pedido cancelado. Cancélalo primero.');
    borrarDonde_('PCLineas', 'pcId', id);
    borrarHistorial_('pedidoCliente', id);
    borrarCambiosPrecio_('pedidoCliente', id);
    borrarFila_(hoja_('PedidosCliente'), pc._fila);
  });
  return jsonOut_({ ok: true });
}

// ---------- Contenedores ----------

function handleListContenedores_(body) {
  requireAuth_(body);
  var nombres = mapaNombres_();
  var cargasPor = {};
  leer_('Cargas').filas.forEach(function (c) {
    if (!c.id) return;
    (cargasPor[c.contenedorId] = cargasPor[c.contenedorId] || []).push(limpiar_(c));
  });
  var lista = leer_('Contenedores').filas.filter(function (c) { return c.id; }).map(function (c) {
    var x = limpiar_(c);
    x.estado = normalizarEstadoContenedor_(c.estado);
    x.creadoNombre = nombreDe_(nombres, c.creadoPor);
    x.cargas = cargasPor[c.id] || [];
    return x;
  });
  lista.sort(function (a, b) { return String(b.fechaCreacion).localeCompare(String(a.fechaCreacion)); });
  return jsonOut_({ ok: true, contenedores: lista });
}

function handleGuardarContenedor_(body) {
  var user = requireEditor_(body);
  var d = body.datos || {};
  var obj = {
    numero: texto_(d.numero, 30).toUpperCase(),
    tipo: TIPOS_CONTENEDOR.indexOf(String(d.tipo)) === -1 ? '40HC' : String(d.tipo),
    naviera: texto_(d.naviera, 60),
    bl: texto_(d.bl, 60),
    puertoOrigen: texto_(d.puertoOrigen, 60),
    puertoDestino: texto_(d.puertoDestino, 60),
    etd: texto_(d.etd, 10),
    eta: texto_(d.eta, 10),
    notas: texto_(d.notas, 2000)
  };
  if (!obj.numero) throw new Error('El número o referencia del contenedor es obligatorio.');
  if (obj.etd && !fechaValida_(obj.etd)) throw new Error('La fecha estimada de salida no es válida.');
  if (obj.eta && !fechaValida_(obj.eta)) throw new Error('La fecha estimada de llegada no es válida.');
  var id = String(body.id || '').trim();

  var final = conLock_(['contenedores', 'historial'], function () {
    var t = leer_('Contenedores');
    var repetido = t.filas.filter(function (c) { return c.id !== id && c.numero.toUpperCase() === obj.numero; })[0];
    if (repetido) throw new Error('Ya existe un contenedor ' + obj.numero + '.');
    if (id) {
      var actual = buscar_(t, 'id', id);
      if (!actual) throw new Error('El contenedor ya no existe.');
      Object.keys(obj).forEach(function (k) { actual[k] = obj[k]; });
      escribir_('Contenedores', actual);
      return id;
    }
    obj.id = nuevoId_();
    obj.estado = 'preparando';
    obj.creadoPor = user.usuario;
    obj.fechaCreacion = new Date().toISOString();
    agregar_('Contenedores', obj);
    agregarHistorial_('contenedor', obj.id, 'preparando', hoy_(), user.usuario, '');
    return obj.id;
  });
  return jsonOut_({ ok: true, id: final });
}

/**
 * Reemplaza lo que lleva un contenedor en preparación. `cargas` es una lista
 * de { lineaId, cantidad }. Valida que ninguna línea quede con más cantidad
 * cargada (sumando todos los contenedores) que la pedida.
 */
function handleGuardarCargas_(body) {
  requireEditor_(body);
  var contenedorId = String(body.contenedorId || '').trim();
  var entrada = Array.isArray(body.cargas) ? body.cargas : [];

  conLock_(['contenedores', 'pedidos'], function () {
    var c = buscar_(leer_('Contenedores'), 'id', contenedorId);
    if (!c) throw new Error('El contenedor ya no existe.');
    if (normalizarEstadoContenedor_(c.estado) !== 'preparando') {
      throw new Error('Solo se cambia la carga de un contenedor en preparación.');
    }
    var lineas = leer_('PedidoLineas');
    var pedidos = leer_('Pedidos');
    var tC = leer_('Cargas');
    // Lo cargado en OTROS contenedores, por línea.
    var enOtros = {};
    tC.filas.forEach(function (x) {
      if (x.contenedorId !== contenedorId) enOtros[x.lineaId] = (enOtros[x.lineaId] || 0) + Number(x.cantidad || 0);
    });

    var nuevas = [];
    var porLinea = {};
    entrada.forEach(function (e) {
      var cantidad = numero_(e.cantidad, 'La cantidad');
      if (!(cantidad > 0)) return;
      var l = buscar_(lineas, 'id', String(e.lineaId || ''));
      if (!l) throw new Error('Una de las líneas ya no existe.');
      var p = buscar_(pedidos, 'id', l.pedidoId);
      if (!p || p.estado === 'cancelado') throw new Error('No se puede cargar un pedido cancelado.');
      porLinea[l.id] = (porLinea[l.id] || 0) + cantidad;
      if (porLinea[l.id] + (enOtros[l.id] || 0) > Number(l.cantidad)) {
        throw new Error(p.folio + ' / ' + l.codigo + ': se cargaría más de lo pedido (' + l.cantidad + ').');
      }
      nuevas.push({ id: nuevoId_(), contenedorId: contenedorId, pedidoId: l.pedidoId, lineaId: l.id, cantidad: cantidad });
    });

    borrarDonde_('Cargas', 'contenedorId', contenedorId);
    nuevas.forEach(function (n) { agregar_('Cargas', n); });
  });
  return jsonOut_({ ok: true });
}

function handleCambiarEstadoContenedor_(body) {
  var user = requireEditor_(body);
  var estado = String(body.estado || '');
  if (ESTADOS_CONTENEDOR.indexOf(estado) === -1) throw new Error('Estado de contenedor no válido.');
  var fecha = fechaCambio_(body.fecha);
  var nota = texto_(body.nota, 500);

  conLock_(['contenedores', 'pedidos', 'historial'], function () {
    var c = buscar_(leer_('Contenedores'), 'id', String(body.id || ''));
    if (!c) throw new Error('El contenedor ya no existe.');
    if (normalizarEstadoContenedor_(c.estado) === estado) throw new Error('El contenedor ya está en ese estado.');
    var cargas = leer_('Cargas').filas.filter(function (x) { return x.contenedorId === c.id; });
    if (estado !== 'preparando' && !cargas.length) throw new Error('El contenedor está vacío: asigna la carga primero.');
    validarFechaSecuencia_('contenedor', c.id, fecha);
    c.estado = estado;
    escribir_('Contenedores', c);
    agregarHistorial_('contenedor', c.id, estado, fecha, user.usuario, nota);
    recalcularPedidos_(unicos_(cargas.map(function (x) { return x.pedidoId; })), fecha, user.usuario, c.numero);
  });
  return jsonOut_({ ok: true });
}

function handleBorrarContenedor_(body) {
  requireEditor_(body);
  var id = String(body.id || '').trim();
  conLock_(['contenedores', 'historial'], function () {
    var c = buscar_(leer_('Contenedores'), 'id', id);
    if (!c) throw new Error('El contenedor ya no existe.');
    if (buscar_(leer_('Cargas'), 'contenedorId', id)) throw new Error('Quita la carga del contenedor antes de borrarlo.');
    borrarHistorial_('contenedor', id);
    borrarFila_(hoja_('Contenedores'), c._fila);
  });
  return jsonOut_({ ok: true });
}

/**
 * Estado de cada pedido a partir de sus contenedores ya despachados: el menos
 * avanzado. Si ninguno salió, vuelve a "fabricado" (si estaba en un estado
 * heredado). No toca pedidos entregados ni cancelados. Debe llamarse con el lock.
 */
function recalcularPedidos_(pedidoIds, fecha, usuario, referencia) {
  if (!pedidoIds.length) return;
  var estadoCont = {};
  leer_('Contenedores').filas.forEach(function (c) { estadoCont[c.id] = normalizarEstadoContenedor_(c.estado); });
  var cargas = leer_('Cargas').filas;
  var tP = leer_('Pedidos');

  pedidoIds.forEach(function (pid) {
    var p = buscar_(tP, 'id', pid);
    if (!p) return;
    var actual = normalizarEstadoPedido_(p.estado);
    if (actual === 'entregado' || actual === 'cancelado') return;
    var estados = unicos_(cargas.filter(function (x) { return x.pedidoId === pid; })
      .map(function (x) { return estadoCont[x.contenedorId]; }))
      .filter(function (e) { return e && e !== 'preparando'; });
    var nuevo = estadoHeredado_(estados, actual);
    if (nuevo === actual) return;
    // Si el contenedor se movió con una fecha anterior al último cambio del pedido, se conserva el orden.
    var h = historialDe_('pedido', pid);
    var fechaPedido = h.length && h[h.length - 1].fecha > fecha ? h[h.length - 1].fecha : fecha;
    p.estado = nuevo;
    p.fechaEstado = fechaPedido;
    escribir_('Pedidos', p);
    agregarHistorial_('pedido', pid, nuevo, fechaPedido, usuario, referencia ? 'Contenedor ' + referencia : '');
  });
}

/** Estados de contenedor despachados → estado del pedido. Ver recalcularPedidos_. */
function estadoHeredado_(estadosContenedor, actual) {
  if (!estadosContenedor.length) {
    return ordenPedido_(actual) >= ordenPedido_('embarcado') ? 'fabricado' : actual;
  }
  var min = estadosContenedor.reduce(function (m, e) {
    return ESTADOS_CONTENEDOR.indexOf(e) < ESTADOS_CONTENEDOR.indexOf(m) ? e : m;
  });
  return min; // embarcado, en_transito, en_puerto y desembarcado se llaman igual en ambos
}

// ---------- Historial ----------

function agregarHistorial_(entidad, entidadId, estado, fecha, usuario, nota) {
  agregar_('Historial', {
    id: nuevoId_(), entidad: entidad, entidadId: entidadId, estado: estado, fecha: fecha,
    usuario: usuario, nota: nota || '', registrado: new Date().toISOString()
  });
}

/** Cambios de estado en orden de registro (el último es el que dejó el estado actual). */
function historialDe_(entidad, entidadId) {
  return leer_('Historial').filas.filter(function (h) { return h.entidad === entidad && h.entidadId === entidadId; });
}

/**
 * La fecha de un cambio no puede ser anterior a la del cambio previo, para que
 * la línea de tiempo sea coherente. Un contenedor nace «preparando» con la fecha
 * de alta, que no cuenta (se puede registrar su embarque con fecha pasada).
 */
function validarFechaSecuencia_(entidad, entidadId, fecha) {
  var h = historialDe_(entidad, entidadId);
  var previo = h[h.length - 1];
  if (!previo || (entidad === 'contenedor' && h.length === 1)) return;
  if (fecha < previo.fecha) {
    throw new Error('La fecha no puede ser anterior al estado previo (' + previo.fecha.split('-').reverse().join('/') + ').');
  }
}

function handleListHistorial_(body) {
  requireAuth_(body);
  var nombres = mapaNombres_();
  var lista = historialDe_(String(body.entidad || ''), String(body.entidadId || '')).map(function (h) {
    var x = limpiar_(h);
    x.usuarioNombre = nombreDe_(nombres, h.usuario);
    return x;
  });
  return jsonOut_({ ok: true, historial: lista });
}

function borrarHistorial_(entidad, entidadId) {
  var sheet = hoja_('Historial');
  leer_('Historial').filas.filter(function (h) { return h.entidad === entidad && h.entidadId === entidadId; })
    .sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (h) { borrarFila_(sheet, h._fila); });
}

/**
 * Solo el admin: quita el último cambio de estado y vuelve al anterior.
 * En un contenedor se recalculan sus pedidos; en un pedido solo se deshacen
 * cambios manuales (los heredados se deshacen desde el contenedor).
 */
function handleDeshacerEstado_(body) {
  var user = requireAdmin_(body);
  var entidad = String(body.entidad || '');
  var id = String(body.id || '');
  if (entidad !== 'pedido' && entidad !== 'contenedor' && entidad !== 'pedidoCliente') throw new Error('Entidad no válida.');

  conLock_(['pedidos', 'contenedores', 'historial', 'pedidosCliente'], function () {
    var hist = historialDe_(entidad, id);
    if (hist.length < 2) throw new Error('No hay un cambio anterior al que volver.');
    var ultimo = hist[hist.length - 1];
    var anterior = hist[hist.length - 2];
    if (entidad === 'pedidoCliente') {
      var pcl = buscar_(leer_('PedidosCliente'), 'id', id);
      if (!pcl) throw new Error('El pedido ya no existe.');
      pcl.estado = anterior.estado;
      pcl.fechaEstado = anterior.fecha;
      escribir_('PedidosCliente', pcl);
      borrarFila_(hoja_('Historial'), ultimo._fila);
    } else if (entidad === 'pedido') {
      var p = buscar_(leer_('Pedidos'), 'id', id);
      if (!p) throw new Error('El pedido ya no existe.');
      if (MANUALES_PEDIDO.indexOf(ultimo.estado) === -1) {
        throw new Error('Ese estado lo puso un contenedor: deshazlo desde el contenedor.');
      }
      p.estado = anterior.estado;
      p.fechaEstado = anterior.fecha;
      escribir_('Pedidos', p);
      borrarFila_(hoja_('Historial'), ultimo._fila);
      // Si el estado al que vuelve lo daban los contenedores, puede haber quedado desactualizado.
      recalcularPedidos_([id], anterior.fecha, user.usuario, '');
    } else {
      var c = buscar_(leer_('Contenedores'), 'id', id);
      if (!c) throw new Error('El contenedor ya no existe.');
      c.estado = anterior.estado;
      escribir_('Contenedores', c);
      borrarFila_(hoja_('Historial'), ultimo._fila);
      var pedidos = unicos_(leer_('Cargas').filas.filter(function (x) { return x.contenedorId === id; })
        .map(function (x) { return x.pedidoId; }));
      recalcularPedidos_(pedidos, anterior.fecha, user.usuario, c.numero + ' (deshecho)');
    }
  });
  return jsonOut_({ ok: true });
}

// ---------- Configuración ----------

var CONFIG_EDITABLE = ['tipoCambio', 'empresa', 'condiciones', 'plazoFabricacion', 'plazoTransito', 'pausas'];

/** Valida 'yyyy-MM-dd' y devuelve el texto; error con el nombre del campo si no es una fecha real. */
function fechaDia_(valor, nombre) {
  var t = String(valor == null ? '' : valor).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  var d = m && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (!m || d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new Error('La fecha «' + nombre + '» no es válida.');
  }
  return t;
}

/** Pausas de la fábrica como JSON [{desde, hasta}], con fechas reales y desde <= hasta. Devuelve el texto normalizado. */
function pausasConfig_(texto) {
  var lista;
  try { lista = JSON.parse(String(texto || '[]')); } catch (e) { throw new Error('Las pausas no tienen un formato válido.'); }
  if (!Array.isArray(lista)) throw new Error('Las pausas no tienen un formato válido.');
  if (lista.length > 40) throw new Error('Hay demasiadas pausas.');
  var anios = {};
  var limpias = lista.map(function (p) {
    var desde = fechaDia_(p && p.desde, 'desde');
    var hasta = fechaDia_(p && p.hasta, 'hasta');
    if (desde > hasta) throw new Error('Una pausa termina antes de empezar.');
    // Cada año tiene su propia pausa; sin año explícito se toma el de la fecha de inicio.
    var anio = Math.floor(Number(p && p.anio)) || Number(desde.slice(0, 4));
    if (!(anio >= 2000 && anio <= 2100)) throw new Error('El año de la pausa no es válido.');
    if (anios[anio]) throw new Error('Hay dos pausas del año ' + anio + '. Cada año tiene una sola.');
    anios[anio] = true;
    return { anio: anio, desde: desde, hasta: hasta };
  });
  limpias.sort(function (a, b) { return a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0; });
  return JSON.stringify(limpias);
}

function leerConfig_() {
  var cfg = {};
  leer_('Config').filas.forEach(function (r) { if (r.clave) cfg[r.clave] = r.valor; });
  return cfg;
}

function guardarConfig_(clave, valor) {
  var t = leer_('Config');
  var fila = buscar_(t, 'clave', clave);
  if (fila) {
    fila.valor = valor;
    escribir_('Config', fila);
  } else {
    agregar_('Config', { clave: clave, valor: valor });
  }
}

function handleGetConfig_(body) {
  requireAuth_(body);
  var cfg = leerConfig_();
  return jsonOut_({ ok: true, config: [{
    tipoCambio: Number(cfg.tipoCambio) || 0,
    empresa: String(cfg.empresa || ''),
    condiciones: String(cfg.condiciones || ''),
    plazoFabricacion: Number(cfg.plazoFabricacion) || 90,
    plazoTransito: Number(cfg.plazoTransito) || 90,
    pausas: String(cfg.pausas || '[]')
  }] });
}

function handleSetConfig_(body) {
  requireAdmin_(body);
  var clave = String(body.clave || '');
  if (CONFIG_EDITABLE.indexOf(clave) === -1) throw new Error('Configuración no editable.');
  conLock_(['config'], function () {
    if (clave === 'tipoCambio') {
      var valor = numero_(body.valor, 'El tipo de cambio');
      if (!(valor > 0)) throw new Error('El tipo de cambio debe ser mayor que cero.');
      guardarConfig_(clave, String(valor));
    } else if (clave === 'plazoFabricacion' || clave === 'plazoTransito') {
      var dias = Math.floor(numero_(body.valor, 'El plazo'));
      if (!(dias >= (clave === 'plazoFabricacion' ? 1 : 0) && dias <= 2000)) throw new Error('El plazo debe estar entre 1 y 2000 días.');
      guardarConfig_(clave, String(dias));
    } else if (clave === 'pausas') {
      guardarConfig_(clave, pausasConfig_(body.valor));
    } else {
      var texto = String(body.valor == null ? '' : body.valor).trim();
      if (texto.length > 2000) throw new Error('El texto es demasiado largo (máximo 2000 caracteres).');
      guardarConfig_(clave, texto);
    }
  });
  return jsonOut_({ ok: true });
}

// ---------- Archivos (Google Drive) ----------

var ENTIDADES_ARCHIVO = { producto: 'Productos', pedido: 'Pedidos' };

function handleListArchivos_(body) {
  requireAuth_(body);
  var nombres = mapaNombres_();
  var entidad = String(body.entidad || '');
  var entidadId = String(body.entidadId || '');
  var lista = leer_('Archivos').filas.filter(function (a) { return a.entidad === entidad && a.entidadId === entidadId; })
    .map(function (a) {
      var x = limpiar_(a);
      x.subidoNombre = nombreDe_(nombres, a.subidoPor);
      return x;
    });
  lista.sort(function (a, b) {
    if (a.principal !== b.principal) return a.principal ? -1 : 1;
    return String(a.fecha).localeCompare(String(b.fecha));
  });
  return jsonOut_({ ok: true, archivos: lista });
}

/**
 * Miniaturas de fotos de producto (base64) para incluirlas en los PDF. Solo se sirven
 * archivos que estén registrados como fotos de producto, hasta 60 por llamada.
 */
function handleFotosDocumento_(body) {
  requireAuth_(body);
  var ids = Array.isArray(body.driveIds) ? body.driveIds : [];
  var permitidos = {};
  leer_('Archivos').filas.forEach(function (a) {
    if (a.entidad === 'producto' && a.mime.indexOf('image/') === 0) permitidos[a.driveId] = true;
  });
  var fotos = {};
  ids.slice(0, 60).forEach(function (id) {
    id = String(id);
    if (!permitidos[id]) return;
    try {
      var miniatura = DriveApp.getFileById(id).getThumbnail();
      if (miniatura) fotos[id] = { mime: miniatura.getContentType(), data: Utilities.base64Encode(miniatura.getBytes()) };
    } catch (e) {
      // Sin miniatura: el documento sale sin esa foto.
    }
  });
  return jsonOut_({ ok: true, fotos: fotos });
}

function handleSubirArchivo_(body) {
  var user = requireEditor_(body);
  var entidad = String(body.entidad || '');
  var entidadId = String(body.entidadId || '');
  if (!ENTIDADES_ARCHIVO[entidad]) throw new Error('No se pueden adjuntar archivos aquí.');
  var registro = buscar_(leer_(ENTIDADES_ARCHIVO[entidad]), 'id', entidadId);
  if (!registro) throw new Error('El registro ya no existe.');

  // Una foto de producto puede pertenecer a uno de sus colores (vacío = general).
  var color = '';
  if (entidad === 'producto' && body.color) color = colorDelProducto_(entidadId, texto_(body.color, 40));

  var nombre = texto_(body.nombre, 150).replace(/[\\/]/g, '-') || 'archivo';
  var mime = texto_(body.mime, 100) || 'application/octet-stream';
  var bytes = Utilities.base64Decode(String(body.base64 || ''));
  if (!bytes.length) throw new Error('El archivo está vacío.');
  if (bytes.length > MAX_ARCHIVO_BYTES) throw new Error('El archivo supera los 10 MB.');

  // Drive se escribe fuera del lock (puede tardar); la fila, dentro.
  var nombreCarpeta = entidad === 'producto' ? registro.codigo : registro.folio;
  var carpeta = subcarpeta_(entidad === 'producto' ? 'Productos' : 'Pedidos', nombreCarpeta);
  var archivo = carpeta.createFile(Utilities.newBlob(bytes, mime, nombre));
  try {
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Algunas cuentas de Workspace no permiten compartir por enlace: el archivo queda privado.
  }

  var revs = entidad === 'producto' ? ['archivos', 'productos'] : ['archivos'];
  conLock_(revs, function () {
    var esImagen = mime.indexOf('image/') === 0;
    var yaHayPrincipal = leer_('Archivos').filas.some(function (a) {
      return a.entidad === entidad && a.entidadId === entidadId && a.principal && a.color === color;
    });
    agregar_('Archivos', {
      id: nuevoId_(), entidad: entidad, entidadId: entidadId, driveId: archivo.getId(), nombre: nombre,
      mime: mime, bytes: bytes.length, principal: entidad === 'producto' && esImagen && !yaHayPrincipal,
      subidoPor: user.usuario, fecha: new Date().toISOString(), color: color
    });
  });
  return jsonOut_({ ok: true, driveId: archivo.getId() });
}

/** Nombre del color tal como lo tiene el producto; error si el producto no tiene ese color. */
function colorDelProducto_(productoId, color) {
  var colores = variantesPorProducto_('ProductoColores', 'color')[productoId] || [];
  var igual = colores.filter(function (c) { return c.toUpperCase() === color.toUpperCase(); })[0];
  if (!igual) throw new Error('El producto no tiene el color «' + color + '». Guarda el producto con ese color primero.');
  return igual;
}

function handleMarcarPrincipal_(body) {
  requireEditor_(body);
  conLock_(['archivos', 'productos'], function () {
    var t = leer_('Archivos');
    var a = buscar_(t, 'id', String(body.id || ''));
    if (!a) throw new Error('El archivo ya no existe.');
    if (a.entidad !== 'producto' || a.mime.indexOf('image/') !== 0) throw new Error('Solo una foto de producto puede ser la principal.');
    t.filas.forEach(function (x) {
      // Hay una principal por color (y una general): solo compiten las fotos del mismo color.
      if (x.entidad !== a.entidad || x.entidadId !== a.entidadId || x.color !== a.color) return;
      var debe = x.id === a.id;
      if (x.principal !== debe) {
        x.principal = debe;
        escribir_('Archivos', x);
      }
    });
  });
  return jsonOut_({ ok: true });
}

function handleBorrarArchivo_(body) {
  requireEditor_(body);
  conLock_(['archivos', 'productos'], function () {
    var a = buscar_(leer_('Archivos'), 'id', String(body.id || ''));
    if (!a) throw new Error('El archivo ya no existe.');
    papelera_(a.driveId);
    borrarFila_(hoja_('Archivos'), a._fila);
  });
  return jsonOut_({ ok: true });
}

/** Manda a la papelera de Drive y borra las filas de los archivos de un registro. Con el lock. */
function borrarArchivosDe_(entidad, entidadId) {
  var sheet = hoja_('Archivos');
  leer_('Archivos').filas.filter(function (a) { return a.entidad === entidad && a.entidadId === entidadId; })
    .sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (a) {
      papelera_(a.driveId);
      borrarFila_(sheet, a._fila);
    });
}

function papelera_(driveId) {
  try {
    DriveApp.getFileById(driveId).setTrashed(true);
  } catch (e) {
    // Ya no existe en Drive o se movió: solo se borra la fila.
  }
}

/** Carpeta raíz de la app (la crea `instalar`). */
function carpetaRaiz_() {
  var id = leerConfig_().carpetaDriveId;
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      throw new Error('No se encuentra la carpeta de archivos en Drive. Ejecuta "instalar" de nuevo.');
    }
  }
  throw new Error('Falta la carpeta de archivos en Drive. Ejecuta "instalar".');
}

/** raíz/<tipo>/<nombre>, creándola si falta. */
function subcarpeta_(tipo, nombre) {
  var t = hijaPorNombre_(carpetaRaiz_(), tipo);
  return hijaPorNombre_(t, String(nombre || 'sin-nombre'));
}

function hijaPorNombre_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

// ---------- Instalación ----------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pedidos ON')
    .addItem('Instalar / reparar hoja', 'instalar')
    .addToUi();
}

/**
 * Crea las pestañas y encabezados que falten, formatos, validaciones, la
 * carpeta de Drive, el tipo de cambio inicial y un admin si no hay ninguno.
 * Es idempotente: se puede ejecutar varias veces sin pisar datos.
 */
function instalar() {
  var ss = getSpreadsheet_(true);
  var creadas = [];

  Object.keys(ENCABEZADOS).forEach(function (nombre) {
    var sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      var primera = ss.getSheets()[0];
      var vacia = ss.getSheets().length === 1 && primera.getLastRow() === 0 && primera.getName() !== nombre;
      sheet = vacia ? primera.setName(nombre) : ss.insertSheet(nombre);
      creadas.push(nombre);
    }
    var cols = ENCABEZADOS[nombre];
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#e8eaf6');
    sheet.setFrozenRows(1);
    // Texto plano salvo números y casillas: así Sheets no convierte fechas ni códigos como "0012".
    cols.forEach(function (c, i) {
      if (NUMERICAS.indexOf(c) === -1 && CASILLAS.indexOf(c) === -1) {
        sheet.getRange(2, i + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
      }
    });
  });

  aplicarValidaciones_(ss);
  var mensaje = creadas.length ? 'Pestañas creadas: ' + creadas.join(', ') + '. ' : 'Las pestañas ya existían. ';

  if (leer_('Tamanos').filas.length === 0) {
    // Tamaños habituales para empezar; se pueden editar, desactivar o agregar en Productos > Tamaños.
    for (var n = 34; n <= 45; n++) agregar_('Tamanos', { id: nuevoId_(), nombre: String(n), grupo: 'Calzado', orden: n, activo: true });
    ['XS', 'S', 'M', 'L', 'XL', 'XXL'].forEach(function (t, i) {
      agregar_('Tamanos', { id: nuevoId_(), nombre: t, grupo: 'Ropa', orden: i + 1, activo: true });
    });
    agregar_('Tamanos', { id: nuevoId_(), nombre: 'Único', grupo: 'Otros', orden: 1, activo: true });
    mensaje += 'Tamaños de ejemplo creados (calzado 34-45, ropa XS-XXL). ';
  }
  var cfg = leerConfig_();
  if (!cfg.tipoCambio) {
    guardarConfig_('tipoCambio', '7500');
    mensaje += 'Tipo de cambio inicial: 7500 Gs/USD (cámbialo en Productos > Precio). ';
  }
  if (!cfg.pausas) {
    // Año Nuevo Chino: la fábrica para unos dos meses. Se ajusta cada año en Configuración.
    guardarConfig_('pausas', JSON.stringify([{ anio: 2027, desde: '2027-01-01', hasta: '2027-02-28' }]));
    mensaje += 'Pausa de fábrica inicial: 01/01/2027 al 28/02/2027 (ajústala en Configuración). ';
  }
  var carpetaOk = false;
  if (cfg.carpetaDriveId) {
    try { DriveApp.getFolderById(cfg.carpetaDriveId); carpetaOk = true; } catch (e) {}
  }
  if (!carpetaOk) {
    var carpeta = DriveApp.createFolder(CARPETA_RAIZ);
    hijaPorNombre_(carpeta, 'Productos');
    hijaPorNombre_(carpeta, 'Pedidos');
    guardarConfig_('carpetaDriveId', carpeta.getId());
    mensaje += 'Carpeta de Drive creada: ' + carpeta.getUrl() + ' . ';
  }

  if (contarAdminsActivos_() === 0) {
    var password = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    agregar_('Usuarios', { usuario: 'ADMIN', password: password, rol: 'admin', activo: true, nombre: '' });
    mensaje += 'Admin inicial: usuario ADMIN, contraseña ' + password +
      ' (también está en la pestaña Usuarios; cámbiala al entrar). ';
  }

  mensaje += 'Hoja: ' + ss.getUrl();
  Logger.log(mensaje);
  try { ss.toast(mensaje, 'Pedidos ON', 30); } catch (e) {}
  return mensaje;
}

/** Listas desplegables y casillas para que editar a mano la hoja no rompa valores. */
function aplicarValidaciones_(ss) {
  var lista = function (valores) {
    return SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(false).build();
  };
  var casilla = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  var filas = 1000;
  var poner = function (hoja, col, regla) {
    ss.getSheetByName(hoja).getRange(2, ENCABEZADOS[hoja].indexOf(col) + 1, filas, 1).setDataValidation(regla);
  };
  Object.keys(ENCABEZADOS).forEach(function (h) {
    CASILLAS.forEach(function (c) { if (ENCABEZADOS[h].indexOf(c) !== -1) poner(h, c, casilla); });
  });
  poner('Usuarios', 'rol', lista(ROLES));
  poner('Pedidos', 'estado', lista(ESTADOS_PEDIDO));
  poner('Contenedores', 'estado', lista(ESTADOS_CONTENEDOR));
  poner('PedidosCliente', 'estado', lista(ESTADOS_PC));
  poner('Contenedores', 'tipo', lista(TIPOS_CONTENEDOR));
}

// ---------- Acceso a la hoja ----------
// Cada pestaña se lee como objetos con las claves de ENCABEZADOS (más `_fila`,
// el número de fila 1-based) y se escribe con el mismo orden de columnas.

function getSpreadsheet_(crear) {
  var activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new Error('No se pudo abrir la hoja (SPREADSHEET_ID). Revisa el ID y los permisos.');
    }
  }
  if (!crear) throw new Error('El backend no está configurado: ejecuta la función "instalar" una vez.');
  var ss = SpreadsheetApp.create('Pedidos ON');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Hoja creada: ' + ss.getUrl());
  return ss;
}

function hoja_(nombre) {
  var sheet = getSpreadsheet_(false).getSheetByName(nombre);
  if (!sheet) throw new Error('No existe la pestaña "' + nombre + '" en la hoja de cálculo. Ejecuta "instalar".');
  return sheet;
}

function leer_(nombre) {
  var sheet = hoja_(nombre);
  var cols = ENCABEZADOS[nombre];
  var rows = sheet.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < rows.length; i++) {
    var o = { _fila: i + 1 };
    for (var j = 0; j < cols.length; j++) o[cols[j]] = valorCelda_(cols[j], rows[i][j], nombre);
    filas.push(o);
  }
  return { sheet: sheet, filas: filas };
}

function valorCelda_(col, v, hoja) {
  if (CASILLAS.indexOf(col) !== -1) return esActivo_(v);
  if (NUMERICAS.indexOf(col) !== -1) return Number(v) || 0;
  if (v instanceof Date) {
    // Si Sheets convirtió una celda en fecha: las de solo día vuelven a 'yyyy-MM-dd', el resto a ISO.
    // 'fecha' es un día en Historial y PedidosCliente, pero un instante en Archivos.
    var esDia = FECHAS_DIA.indexOf(col) !== -1 || (col === 'fecha' && hoja !== 'Archivos');
    return esDia ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : v.toISOString();
  }
  return String(v == null ? '' : v).trim();
}

function aFila_(nombre, obj) {
  return ENCABEZADOS[nombre].map(function (c) {
    var v = obj[c];
    if (CASILLAS.indexOf(c) !== -1) return v === true;
    if (NUMERICAS.indexOf(c) !== -1) return Number(v) || 0;
    return v == null ? '' : String(v);
  });
}

function agregar_(nombre, obj) {
  hoja_(nombre).appendRow(aFila_(nombre, obj));
}

function escribir_(nombre, obj) {
  var fila = aFila_(nombre, obj);
  hoja_(nombre).getRange(obj._fila, 1, 1, fila.length).setValues([fila]);
}

function buscar_(tabla, col, valor) {
  var v = String(valor || '');
  if (!v) return null;
  for (var i = 0; i < tabla.filas.length; i++) {
    if (tabla.filas[i][col] === v) return tabla.filas[i];
  }
  return null;
}

/** Borra todas las filas donde `col` = valor (de abajo hacia arriba). */
function borrarDonde_(nombre, col, valor) {
  var sheet = hoja_(nombre);
  leer_(nombre).filas.filter(function (r) { return r[col] === valor; })
    .sort(function (a, b) { return b._fila - a._fila; })
    .forEach(function (r) { borrarFila_(sheet, r._fila); });
}

/**
 * Borra una fila. Sheets no deja eliminar todas las filas no inmovilizadas:
 * si solo queda una fila de datos, se agrega una vacía antes de borrar.
 */
function borrarFila_(sheet, fila) {
  if (sheet.getMaxRows() - sheet.getFrozenRows() <= 1) sheet.insertRowAfter(sheet.getMaxRows());
  sheet.deleteRow(fila);
}

/** Copia sin `_fila`, para mandar al frontend. */
function limpiar_(o) {
  var x = {};
  Object.keys(o).forEach(function (k) { if (k !== '_fila') x[k] = o[k]; });
  return x;
}

function mapaNombresCatalogo_(hoja) {
  var m = {};
  leer_(hoja).filas.forEach(function (r) { m[r.id] = r.nombre; });
  return m;
}

/** Cantidad cargada en contenedores, por id de línea. */
function cargadoPorLinea_() {
  var m = {};
  leer_('Cargas').filas.forEach(function (c) { m[c.lineaId] = (m[c.lineaId] || 0) + Number(c.cantidad || 0); });
  return m;
}

function validarReferencia_(hoja, id, etiqueta) {
  if (!id) return;
  var r = buscar_(leer_(hoja), 'id', id);
  if (!r) throw new Error(etiqueta + ' no existe.');
}

// ---------- Normalización ----------

function nuevoId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }

function texto_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }

/** Número >= 0; vacío = 0. Acepta coma decimal. */
function numero_(v, etiqueta) {
  if (v === '' || v == null) return 0;
  var n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (isNaN(n) || n < 0) throw new Error(etiqueta + ' no es un número válido.');
  return Math.round(n * 10000) / 10000;
}

function hoy_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function fechaValida_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  return d.toISOString().slice(0, 10) === s;
}

/** Fecha de un cambio de estado: la indicada (no futura) o hoy. */
function fechaCambio_(v) {
  var f = texto_(v, 10);
  if (!f) return hoy_();
  if (!fechaValida_(f)) throw new Error('La fecha del cambio no es válida.');
  if (f > hoy_()) throw new Error('La fecha del cambio no puede ser futura.');
  return f;
}

function normalizarRol_(valor) {
  var r = String(valor || '').trim().toLowerCase();
  return ROLES.indexOf(r) === -1 ? 'consulta' : r;
}

function normalizarEstadoPedido_(v) {
  var e = String(v || '').trim().toLowerCase();
  return ESTADOS_PEDIDO.indexOf(e) === -1 ? 'registrado' : e;
}

function normalizarEstadoContenedor_(v) {
  var e = String(v || '').trim().toLowerCase();
  return ESTADOS_CONTENEDOR.indexOf(e) === -1 ? 'preparando' : e;
}

function ordenPedido_(estado) { return ESTADOS_PEDIDO.indexOf(estado); }

function unicos_(lista) {
  var visto = {};
  return lista.filter(function (x) {
    if (visto[x]) return false;
    visto[x] = true;
    return true;
  });
}

/** Acepta TRUE, SI, SÍ, X o 1 (casilla de verificación) como verdadero. */
function esActivo_(valor) {
  if (valor === true) return true;
  if (valor === false) return false;
  var t = String(valor).trim().toUpperCase().replace('Í', 'I');
  return t === 'TRUE' || t === 'SI' || t === 'X' || t === '1';
}

function jsonOut_(obj) {
  // Tras una escritura que salió bien se devuelven los contadores ya incrementados: el frontend refresca sin pedirlos antes.
  if (ADJUNTAR_REVISIONES_ && obj && obj.ok === true && !obj.revisiones) obj.revisiones = revisionesActuales_();
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

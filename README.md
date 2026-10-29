# Pedidos ON

Seguimiento de pedidos a fábricas de China: desde que se registra el pedido y entra en fabricación, hasta que el contenedor se desembarca. Cada cambio de estado guarda su fecha y quién lo registró.

Frontend: React 19 + Vite + Tailwind 4 (Vercel). Backend: Google Apps Script sobre Google Sheets. Archivos (fotos de productos y documentos de pedidos): carpeta de Google Drive.

## Cómo funciona

- **Pedido**: una fábrica (proveedor) + un cliente (opcional: vacío = stock propio) + líneas de producto. Un cliente puede tener varios pedidos de distintas fábricas; su ficha los muestra todos.
- **Productos con colores y tamaños** (calzado, ropa, accesorios…): un producto es un modelo con su código, descripción, marca y precios, y lleva su lista de **colores** y de **tamaños** (tallas). Los tamaños se agrupan (Calzado 34-45, Ropa XS-XXL…) y se administran en Catálogos. Un producto sin colores ni tamaños (un accesorio) es una sola línea.
- **Al agregar un producto a un pedido** aparece, por cada color, su **curva** (unidades de cada tamaño en una caja) y sus **cajas**; el total es unidades por caja × cajas (ej. 1·1·2·2·1 = 7 × 5 cajas = 35). Cada color y tamaño es una línea del pedido (con su curva y cajas guardadas), y cada línea se puede cargar por separado en contenedores.
- **Precios**: costo (USD), venta (USD) y venta (Gs) son del producto y valen para todos sus colores y tamaños. Al agregarlo a un pedido los precios se **copian** a las líneas: si luego cambia el catálogo, el pedido no se altera. El precio en Gs se carga a mano; el botón «Calcular» sugiere venta USD × tipo de cambio (Catálogos).
- **Contenedores**: un contenedor lleva varios pedidos, y un pedido puede repartirse en varios contenedores. Al asignar la carga se indican las **cajas de cada color** que van en ese contenedor (las unidades salen de la curva) o se carga el **pedido completo** de una vez; las líneas sin curva se cargan por unidades. La carga solo se cambia mientras el contenedor está «preparando».
- **Estados del pedido**: `registrado → confirmado → en fabricación → fabricado` (a mano) `→ embarcado → en tránsito → en puerto/aduana → desembarcado` (los da el contenedor) `→ entregado` (a mano), más `cancelado`.
  Si un pedido viaja en varios contenedores, toma el estado del **menos avanzado** de los que ya salieron, y se marca «Embarque parcial» mientras quede algo sin cargar.
- **Estados del contenedor**: `preparando → embarcado → en tránsito → en puerto/aduana → desembarcado`. Al cambiarlo, sus pedidos se actualizan solos.
- **Fechas**: al cambiar un estado se indica la fecha en que ocurrió (hoy por defecto; se puede poner una pasada, no futura ni anterior al cambio previo). El historial muestra fecha, usuario y nota. El admin puede deshacer el último cambio.
- **Archivos**: fotos en cada producto (con foto principal) y documentos en cada pedido (proforma, factura, packing list…), hasta 10 MB cada uno. Las fotos se reducen en el navegador antes de subir. Quedan en Drive con acceso «cualquiera con el enlace» (lectura).

## Roles

| Rol | Puede |
|---|---|
| `admin` | Todo: usuarios, tipo de cambio, borrar pedidos cancelados, deshacer cambios de estado. |
| `operador` | Cargar y modificar pedidos, contenedores, productos y catálogos. |
| `consulta` | Solo ver. |

## Google Sheet y Drive

**Automático:** crea una hoja de cálculo vacía, pega `apps-script/Code.gs` en Apps Script y ejecuta la función `instalar` una vez. Crea las pestañas con sus encabezados, validaciones, la carpeta `Pedidos ON - Archivos` en tu Drive (con subcarpetas `Productos` y `Pedidos`), tamaños de ejemplo (calzado 34-45, ropa XS-XXL, «Único»; edítalos en Catálogos), un tipo de cambio inicial y un usuario `ADMIN` con contraseña aleatoria (la verás en la pestaña `Usuarios`). Es seguro volver a ejecutarla.

| Pestaña | Columnas |
|---|---|
| `Usuarios` | usuario, password, rol, activo, nombre |
| `Proveedores` | id, nombre, contacto, telefono, email, ciudad, notas, activo |
| `Clientes` | id, nombre, ruc, telefono, email, direccion, notas, activo |
| `Marcas` | id, nombre, activo |
| `Tamanos` | id, nombre, grupo, orden, activo |
| `Productos` | id, codigo, descripcion, marcaId, proveedorId, precioCosto, precioVentaUsd, precioVentaGs, activo |
| `ProductoColores` | id, productoId, color |
| `ProductoTamanos` | id, productoId, tamanoId |
| `Pedidos` | id, folio, proveedorId, clienteId, estado, fechaPedido, notas, creadoPor, fechaCreacion, fechaEstado |
| `PedidoLineas` | id, pedidoId, productoId, codigo, descripcion, color, marca, tamano, tamanoId, cantidad, precioCosto, precioVentaUsd, precioVentaGs, porCaja, cajas |
| `Contenedores` | id, numero, tipo, naviera, bl, puertoOrigen, puertoDestino, etd, eta, estado, notas, creadoPor, fechaCreacion |
| `Cargas` | id, contenedorId, pedidoId, lineaId, cantidad |
| `Historial` | id, entidad, entidadId, estado, fecha, usuario, nota, registrado |
| `Archivos` | id, entidad, entidadId, driveId, nombre, mime, bytes, principal, subidoPor, fecha |
| `Config` | clave, valor (`tipoCambio`, `carpetaDriveId`) |

No edites a mano `Pedidos`, `PedidoLineas`, `Cargas` ni `Historial`: el backend los mantiene coherentes entre sí. Los catálogos y usuarios sí se pueden tocar, pero después pulsa ↻ en la app (ver «Caché»).

## Backend (Apps Script)

1. En la hoja: Extensiones → Apps Script. Pega `apps-script/Code.gs` y, en la configuración del proyecto, activa «Mostrar el archivo appsscript.json» y pega `apps-script/appsscript.json` (incluye el permiso de Drive).
2. Elige la función `instalar` y pulsa Ejecutar (acepta los permisos de Sheets y Drive). Si el proyecto no está vinculado a un Sheet (creado desde script.google.com), crea uno llamado «Pedidos ON» en tu Drive; la URL sale en el registro de ejecución.
3. Implementar → Aplicación web → Ejecutar como: **Yo** · Acceso: **Cualquier usuario**.
4. Copia la URL `/exec`.

## Frontend

```bash
cp .env.example .env     # pega la URL /exec en VITE_APPS_SCRIPT_URL
npm install
npm run dev              # http://localhost:5178
npm test                 # lógica pura (estados, cargas, imágenes)
npm run build
```

En Vercel, define la variable de entorno `VITE_APPS_SCRIPT_URL` y despliega el repositorio (framework Vite, `npm run build`, salida `dist`).

## Notas de seguridad

Heredado del proyecto base: las contraseñas se guardan en texto plano en la hoja y viajan en cada llamada. Es aceptable para uso interno de baja criticidad; no reutilices contraseñas personales. Los archivos de Drive son accesibles por quien tenga su enlace (largo y no adivinable).

## Caché y sincronización

Cada tabla se guarda en el navegador junto con un **contador de revisión** que lleva el backend (`bumpRevision_` en `Code.gs`). Al abrir una pantalla se muestra la caché al instante y se pregunta el contador: si no cambió, no se vuelve a descargar. Cada 5 minutos (con la pestaña visible) y al volver a ella se repite la consulta y se refresca en silencio lo que cambió. Al cerrar sesión se borra la caché.

El botón ↻ de la barra superior fuerza la descarga de todo. Úsalo si alguien edita el Sheet **a mano**, porque esos cambios no suben el contador.

Tras actualizar `Code.gs` hay que publicar una **nueva versión** de la aplicación web (Implementar → Administrar implementaciones → editar → Nueva versión).

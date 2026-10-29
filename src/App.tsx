import { Route, Routes } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Catalogos from '@/pages/Catalogos'
import Clientes from '@/pages/Clientes'
import ContenedorDetalle from '@/pages/ContenedorDetalle'
import Contenedores from '@/pages/Contenedores'
import Inicio from '@/pages/Inicio'
import Login from '@/pages/Login'
import NoEncontrado from '@/pages/NoEncontrado'
import PedidoClienteDetalle from '@/pages/PedidoClienteDetalle'
import PedidoDetalle from '@/pages/PedidoDetalle'
import Pedidos from '@/pages/Pedidos'
import PedidosCliente from '@/pages/PedidosCliente'
import Productos from '@/pages/Productos'
import Proveedores from '@/pages/Proveedores'
import Usuarios from '@/pages/Usuarios'

/**
 * Dos zonas: `/login` publica, y todo lo demas dentro de `AppLayout` (exige
 * sesion). Usuarios es solo para admin (la propia pagina redirige); en el
 * resto, el rol `consulta` ve todo sin botones de edicion.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Inicio />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="pedidos/:id" element={<PedidoDetalle />} />
        <Route path="pedidos-cliente" element={<PedidosCliente />} />
        <Route path="pedidos-cliente/:id" element={<PedidoClienteDetalle />} />
        <Route path="contenedores" element={<Contenedores />} />
        <Route path="contenedores/:id" element={<ContenedorDetalle />} />
        <Route path="productos" element={<Productos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="catalogos" element={<Catalogos />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

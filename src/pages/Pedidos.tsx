import { useSearchParams } from 'react-router-dom'
import { ListaPedidosFabrica } from '@/components/pedidos/ListaPedidosFabrica'
import { ListaPedidosCliente } from '@/components/pedidosCliente/ListaPedidosCliente'
import { cn } from '@/lib/utils'

/** Cada pestaña con su nombre y el título y la descripción que la página muestra mientras está elegida. */
const PESTANAS = [
  { clave: 'fabrica', etiqueta: 'A fábrica', titulo: 'Pedidos a fábrica', descripcion: 'Pedidos a fábricas de China y su estado.' },
  {
    clave: 'clientes',
    etiqueta: 'Clientes',
    titulo: 'Pedidos de clientes',
    descripcion: 'Lo que pide cada cliente y de qué pedidos a fábrica se cubre.',
  },
] as const

type Pestana = (typeof PESTANAS)[number]['clave']

/** Pedidos a fábrica y pedidos de clientes, en pestañas. */
export default function Pedidos() {
  // La pestaña va en la dirección (?pestana=clientes) para que recargar o volver atrás no la pierda.
  const [params, setParams] = useSearchParams()
  const pedida = params.get('pestana')
  const actual = PESTANAS.find((p) => p.clave === pedida) ?? PESTANAS[0]
  const pestana: Pestana = actual.clave

  const elegir = (clave: Pestana) => setParams(clave === 'fabrica' ? {} : { pestana: clave }, { replace: true })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">{actual.titulo}</h1>
        <p className="text-sm text-muted-foreground">{actual.descripcion}</p>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
        {PESTANAS.map(({ clave, etiqueta }) => (
          <button
            key={clave}
            onClick={() => elegir(clave)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-2 text-sm transition-colors',
              pestana === clave
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'fabrica' ? <ListaPedidosFabrica /> : <ListaPedidosCliente />}
    </div>
  )
}

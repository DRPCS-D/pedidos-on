import { useSearchParams } from 'react-router-dom'
import { CatalogoSimple, type CampoCatalogo, type ColumnaCatalogo } from '@/components/catalogos/CatalogoSimple'
import { TablasPrecio } from '@/components/catalogos/TablasPrecio'
import { TipoDeCambio } from '@/components/catalogos/TipoDeCambio'
import { ListaProductos } from '@/components/productos/ListaProductos'
import { cn } from '@/lib/utils'

const CAMPOS_NOMBRE: CampoCatalogo[] = [{ clave: 'nombre', label: 'Nombre', max: 60, requerido: true }]
const COLUMNAS_NOMBRE: ColumnaCatalogo[] = [{ label: 'Nombre', render: (r) => r.nombre }]

const CAMPOS_TAMANO: CampoCatalogo[] = [
  { clave: 'nombre', label: 'Nombre', max: 60, requerido: true, hint: 'Ej. 38, 39 (calzado) o S, M, L (ropa).' },
  { clave: 'grupo', label: 'Grupo', max: 40, hint: 'Agrupa los tamaños al elegirlos en un producto. Ej. Calzado, Ropa.' },
  { clave: 'orden', label: 'Orden', max: 6, hint: 'Número para ordenar dentro del grupo (S=1, M=2, L=3…).' },
]
const COLUMNAS_TAMANO: ColumnaCatalogo[] = [
  { label: 'Nombre', render: (r) => r.nombre },
  { label: 'Grupo', render: (r) => r.grupo || '—' },
  { label: 'Orden', render: (r) => String(r.orden ?? '') },
]

const PESTANAS = [
  { clave: 'productos', etiqueta: 'Productos' },
  { clave: 'marcas', etiqueta: 'Marcas' },
  { clave: 'tamanos', etiqueta: 'Tamaños' },
  { clave: 'precio', etiqueta: 'Precio' },
] as const

type Pestana = (typeof PESTANAS)[number]['clave']

/** Productos y lo que los define, en pestañas: la lista, las marcas, los tamaños (tallas) y los precios (tipo de cambio y tablas). */
export default function Productos() {
  // La pestaña va en la dirección (?pestana=precio) para que recargar o volver atrás no la pierda.
  const [params, setParams] = useSearchParams()
  const pedida = params.get('pestana')
  const actual = PESTANAS.find((p) => p.clave === pedida) ?? PESTANAS[0]
  const pestana: Pestana = actual.clave

  const elegir = (clave: Pestana) => setParams(clave === 'productos' ? {} : { pestana: clave }, { replace: true })

  return (
    <div>
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

      {pestana === 'productos' ? (
        <ListaProductos />
      ) : pestana === 'precio' ? (
        <>
          <TipoDeCambio />
          <TablasPrecio />
        </>
      ) : pestana === 'marcas' ? (
        <CatalogoSimple
          tabla="marcas"
          titulo="Marcas"
          singular="marca"
          femenino
          campos={CAMPOS_NOMBRE}
          columnas={COLUMNAS_NOMBRE}
        />
      ) : (
        <CatalogoSimple
          tabla="tamanos"
          titulo="Tamaños"
          singular="tamaño"
          campos={CAMPOS_TAMANO}
          columnas={COLUMNAS_TAMANO}
        />
      )}
    </div>
  )
}

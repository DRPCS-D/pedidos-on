import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CatalogoSimple, type CampoCatalogo, type ColumnaCatalogo } from '@/components/catalogos/CatalogoSimple'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/hooks/useConfig'
import { cn } from '@/lib/utils'

const CAMPOS_NOMBRE: CampoCatalogo[] = [{ clave: 'nombre', label: 'Nombre', max: 60, requerido: true }]
const COLUMNAS_NOMBRE: ColumnaCatalogo[] = [{ label: 'Nombre', render: (r) => r.nombre }]

type Pestana = 'marcas' | 'tamanos'

function TipoDeCambio() {
  const { esAdmin } = useAuth()
  const { tipoCambio, loading, guardarTipoCambio, refetch } = useConfig()
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (tipoCambio) setValor(String(tipoCambio))
  }, [tipoCambio])

  async function onGuardar() {
    const n = Number(valor.replace(',', '.'))
    if (!(n > 0)) return toast.error('Escribe un tipo de cambio mayor que cero.')
    setGuardando(true)
    const { error } = await guardarTipoCambio(n)
    setGuardando(false)
    if (error) toast.error(error)
    else {
      toast.success('Tipo de cambio actualizado.')
      refetch()
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5 shadow-xs">
      <h2 className="text-sm font-semibold text-foreground">Tipo de cambio</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Guaraníes por dólar. Se usa en el botón «Calcular» del precio en Gs de cada producto; no cambia los precios ya guardados.
      </p>
      <div className="mt-3 flex max-w-sm items-end gap-3">
        <Field label="Gs por 1 USD" className="flex-1">
          <Input
            inputMode="decimal"
            value={valor}
            disabled={!esAdmin || loading}
            onChange={(e) => setValor(e.target.value)}
          />
        </Field>
        {esAdmin && (
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        )}
      </div>
      {!esAdmin && <p className="mt-2 text-xs text-muted-foreground">Solo un admin puede cambiarlo.</p>}
    </section>
  )
}

export default function Catalogos() {
  const [pestana, setPestana] = useState<Pestana>('marcas')

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Catálogos</h1>
        <p className="text-sm text-muted-foreground">Marcas y tamaños de los productos, y el tipo de cambio.</p>
      </div>

      <TipoDeCambio />

      <div className="mb-5 flex gap-1 border-b border-border">
        {(
          [
            ['marcas', 'Marcas'],
            ['tamanos', 'Tamaños'],
          ] as const
        ).map(([clave, etiqueta]) => (
          <button
            key={clave}
            onClick={() => setPestana(clave)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
              pestana === clave
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'marcas' ? (
        <CatalogoSimple
          incrustado
          tabla="marcas"
          titulo="Marcas"
          descripcion="Marca de cada producto."
          singular="marca"
          campos={CAMPOS_NOMBRE}
          columnas={COLUMNAS_NOMBRE}
        />
      ) : (
        <CatalogoSimple
          incrustado
          tabla="tamanos"
          titulo="Tamaños"
          descripcion="Talle o medida de cada producto (S, M, L, 50x70 cm…)."
          singular="tamaño"
          campos={CAMPOS_NOMBRE}
          columnas={COLUMNAS_NOMBRE}
        />
      )}
    </div>
  )
}

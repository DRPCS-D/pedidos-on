import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CatalogoSimple, type CampoCatalogo, type ColumnaCatalogo } from '@/components/catalogos/CatalogoSimple'
import { TablasPrecio } from '@/components/catalogos/TablasPrecio'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/hooks/useConfig'
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

function TextosDocumentos() {
  const { esAdmin } = useAuth()
  const { empresa, condiciones, loading, guardarTexto, refetch } = useConfig()
  const [textos, setTextos] = useState({ empresa: '', condiciones: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setTextos({ empresa, condiciones })
  }, [empresa, condiciones])

  async function onGuardar() {
    setGuardando(true)
    const a = await guardarTexto('empresa', textos.empresa)
    const b = a.error ? a : await guardarTexto('condiciones', textos.condiciones)
    setGuardando(false)
    if (b.error) toast.error(b.error)
    else {
      toast.success('Textos de los documentos actualizados.')
      refetch()
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5 shadow-xs">
      <h2 className="text-sm font-semibold text-foreground">Documentos (PDF y Excel)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Textos que salen en los pedidos descargados: los datos de la empresa arriba y las condiciones en el pedido de cliente.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Field label="Datos de la empresa" hint="Razón social, RUC, dirección, teléfono… una línea por dato.">
          <Textarea
            rows={5}
            maxLength={2000}
            value={textos.empresa}
            disabled={!esAdmin || loading}
            onChange={(e) => setTextos((t) => ({ ...t, empresa: e.target.value }))}
          />
        </Field>
        <Field label="Condiciones del pedido de cliente" hint="Plazo de entrega, forma de pago, validez…">
          <Textarea
            rows={5}
            maxLength={2000}
            value={textos.condiciones}
            disabled={!esAdmin || loading}
            onChange={(e) => setTextos((t) => ({ ...t, condiciones: e.target.value }))}
          />
        </Field>
      </div>
      {esAdmin ? (
        <Button className="mt-3" onClick={onGuardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar textos'}
        </Button>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Solo un admin puede cambiarlos.</p>
      )}
    </section>
  )
}

export default function Catalogos() {
  const [pestana, setPestana] = useState<Pestana>('marcas')

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Catálogos</h1>
        <p className="text-sm text-muted-foreground">Marcas, tamaños (tallas), tipo de cambio y tablas de precio.</p>
      </div>

      <TipoDeCambio />
      <TablasPrecio />
      <TextosDocumentos />

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
          descripcion="Tallas y medidas en que vienen los productos (36, 37… para calzado; S, M, L para ropa)."
          singular="tamaño"
          campos={CAMPOS_TAMANO}
          columnas={COLUMNAS_TAMANO}
        />
      )}
    </div>
  )
}

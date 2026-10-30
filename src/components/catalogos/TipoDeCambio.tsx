import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/hooks/useConfig'

/** Guaraníes por dólar, para el botón «Calcular» del precio en Gs de cada producto. */
export function TipoDeCambio() {
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

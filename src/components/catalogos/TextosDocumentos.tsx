import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { useConfig } from '@/hooks/useConfig'

/** Textos que salen en los documentos descargados: datos de la empresa y condiciones del pedido de cliente. */
export function TextosDocumentos() {
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

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { formatUsd } from '@/lib/format'
import { totalConAjustes } from '@/lib/pedidos'
import type { CargoPedido, DescuentoTipo } from '@/lib/tipos'

export interface AjustesForm {
  descuentoTipo: DescuentoTipo
  descuentoValor: string
  descuentoMotivo: string
  cargos: { concepto: string; monto: string }[]
}

export const AJUSTES_VACIOS: AjustesForm = { descuentoTipo: '', descuentoValor: '', descuentoMotivo: '', cargos: [] }

const num = (s: string) => {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function ajustesDePedido(p: { descuentoTipo: DescuentoTipo; descuentoValor: number; descuentoMotivo: string; cargos: CargoPedido[] }): AjustesForm {
  return {
    descuentoTipo: p.descuentoTipo,
    descuentoValor: p.descuentoValor ? String(p.descuentoValor) : '',
    descuentoMotivo: p.descuentoMotivo,
    cargos: p.cargos.map((c) => ({ concepto: c.concepto, monto: String(c.monto) })),
  }
}

/** Valores numéricos del formulario, listos para el cálculo y para guardar. */
export function ajustesNumericos(a: AjustesForm) {
  const cargos: CargoPedido[] = a.cargos.filter((c) => c.concepto.trim() || num(c.monto)).map((c) => ({ concepto: c.concepto.trim(), monto: num(c.monto) }))
  const descuentoValor = a.descuentoTipo ? num(a.descuentoValor) : 0
  return {
    descuentoTipo: descuentoValor ? a.descuentoTipo : ('' as DescuentoTipo),
    descuentoValor,
    descuentoMotivo: descuentoValor ? a.descuentoMotivo.trim() : '',
    cargos,
  }
}

/** Descuento sobre el total de costos y cargos adicionales (flete, seguro…) de un pedido a fábrica. */
export function AjustesCostoEditor({ valor, onChange, subtotal }: { valor: AjustesForm; onChange: (a: AjustesForm) => void; subtotal: number }) {
  const n = ajustesNumericos(valor)
  const t = totalConAjustes(subtotal, n)
  const setCargo = (i: number, parte: Partial<AjustesForm['cargos'][number]>) =>
    onChange({ ...valor, cargos: valor.cargos.map((c, k) => (k === i ? { ...c, ...parte } : c)) })

  return (
    <section className="space-y-4 rounded-md border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Descuento y cargos adicionales</h3>

      <div className="grid gap-3 sm:grid-cols-[10rem_8rem_1fr]">
        <Field label="Descuento sobre el total">
          <Select
            value={valor.descuentoTipo}
            onChange={(e) => onChange({ ...valor, descuentoTipo: e.target.value as DescuentoTipo })}
          >
            <option value="">Sin descuento</option>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto">Monto (USD)</option>
          </Select>
        </Field>
        <Field label={valor.descuentoTipo === 'porcentaje' ? 'Porcentaje' : 'Monto USD'}>
          <Input
            inputMode="decimal"
            disabled={!valor.descuentoTipo}
            value={valor.descuentoValor}
            onChange={(e) => onChange({ ...valor, descuentoValor: e.target.value })}
          />
        </Field>
        <Field label="Motivo">
          <Input
            disabled={!valor.descuentoTipo}
            maxLength={120}
            placeholder="Ej.: descuento por volumen"
            value={valor.descuentoMotivo}
            onChange={(e) => onChange({ ...valor, descuentoMotivo: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Cargos adicionales (USD): flete, seguro, muestras, embalaje…</p>
        {valor.cargos.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
            <Input aria-label="Concepto" placeholder="Concepto" maxLength={80} value={c.concepto} onChange={(e) => setCargo(i, { concepto: e.target.value })} />
            <Input aria-label="Monto USD" inputMode="decimal" placeholder="Monto" value={c.monto} onChange={(e) => setCargo(i, { monto: e.target.value })} />
            <Button variant="ghost" size="sm" aria-label="Quitar cargo" onClick={() => onChange({ ...valor, cargos: valor.cargos.filter((_, k) => k !== i) })}>
              <X />
            </Button>
          </div>
        ))}
        {valor.cargos.length < 20 && (
          <Button variant="outline" size="sm" onClick={() => onChange({ ...valor, cargos: [...valor.cargos, { concepto: '', monto: '' }] })}>
            <Plus /> Agregar cargo
          </Button>
        )}
      </div>

      {(t.descuento > 0 || t.cargos > 0) && (
        <dl className="tabular ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd>{formatUsd(t.subtotal)}</dd>
          </div>
          {t.descuento > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Descuento{n.descuentoTipo === 'porcentaje' ? ` (${n.descuentoValor}%)` : ''}</dt>
              <dd>− {formatUsd(t.descuento)}</dd>
            </div>
          )}
          {t.cargos > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Cargos adicionales</dt>
              <dd>+ {formatUsd(t.cargos)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-medium text-foreground">
            <dt>Total</dt>
            <dd>{formatUsd(t.total)}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

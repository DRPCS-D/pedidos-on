import { ejecutar } from '@/lib/ejecutar'
import { TABLAS } from '@/lib/tablas'
import type { Config } from '@/lib/tipos'
import { useTabla } from './useTabla'

/** Configuración global (hoy solo el tipo de cambio Gs/USD). */
export function useConfig() {
  const lista = useTabla<Config>(TABLAS.config)
  const tipoCambio = lista.data[0]?.tipoCambio ?? 0

  const guardarTipoCambio = (valor: number) =>
    ejecutar('setConfig', { clave: 'tipoCambio', valor }, 'No se pudo guardar el tipo de cambio.')

  return { ...lista, tipoCambio, guardarTipoCambio }
}

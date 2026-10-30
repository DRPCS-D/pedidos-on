import { ejecutar } from '@/lib/ejecutar'
import { plazosDe } from '@/lib/proyeccion'
import { TABLAS } from '@/lib/tablas'
import type { Config } from '@/lib/tipos'
import { useTabla } from './useTabla'

/** Configuración global: tipo de cambio Gs/USD y textos de los documentos. */
export function useConfig() {
  const lista = useTabla<Config>(TABLAS.config)
  const tipoCambio = lista.data[0]?.tipoCambio ?? 0

  const guardarTipoCambio = (valor: number) =>
    ejecutar('setConfig', { clave: 'tipoCambio', valor }, 'No se pudo guardar el tipo de cambio.')

  const empresa = lista.data[0]?.empresa ?? ''
  const condiciones = lista.data[0]?.condiciones ?? ''

  const guardarTexto = (clave: 'empresa' | 'condiciones', valor: string) =>
    ejecutar('setConfig', { clave, valor }, 'No se pudo guardar.')

  const plazos = plazosDe(lista.data[0])
  const guardarPlazo = (clave: 'plazoFabricacion' | 'plazoTransito' | 'pausas', valor: number | string) =>
    ejecutar('setConfig', { clave, valor }, 'No se pudo guardar.')

  return { ...lista, tipoCambio, empresa, condiciones, plazos, guardarTipoCambio, guardarTexto, guardarPlazo }
}

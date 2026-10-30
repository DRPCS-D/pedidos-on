import { useMemo } from 'react'
import { ejecutar, ejecutarConDatos } from '@/lib/ejecutar'
import { quitarDeLista } from '@/lib/parches'
import { TABLAS, parchearTabla } from '@/lib/tablas'
import type { Contenedor, EstadoContenedor, TipoContenedor } from '@/lib/tipos'
import { useTabla } from './useTabla'

export interface DatosContenedor {
  numero: string
  tipo: TipoContenedor
  naviera: string
  bl: string
  puertoOrigen: string
  puertoDestino: string
  etd: string
  eta: string
  notas: string
}

export function useContenedores() {
  const lista = useTabla<Contenedor>(TABLAS.contenedores)

  const porId = useMemo(() => new Map(lista.data.map((c) => [c.id, c])), [lista.data])

  const guardar = (id: string | null, datos: DatosContenedor) =>
    ejecutarConDatos<{ id: string }>(
      'guardarContenedor',
      { id: id ?? '', datos },
      'No se pudo guardar el contenedor.',
    )
  /** Reemplaza lo que lleva el contenedor. */
  const guardarCargas = (contenedorId: string, cargas: { lineaId: string; cantidad: number }[]) =>
    ejecutar('guardarCargas', { contenedorId, cargas }, 'No se pudo guardar la carga.')
  const cambiarEstado = (id: string, estado: EstadoContenedor, fecha: string, nota: string) =>
    ejecutar('cambiarEstadoContenedor', { id, estado, fecha, nota }, 'No se pudo cambiar el estado.')
  const borrar = async (id: string) => {
    const r = await ejecutar('borrarContenedor', { id }, 'No se pudo borrar el contenedor.')
    if (!r.error) parchearTabla(TABLAS.contenedores, {}, (lista) => quitarDeLista(lista as { id: string }[], id))
    return r
  }
  const deshacerEstado = (id: string) =>
    ejecutar('deshacerEstado', { entidad: 'contenedor', id }, 'No se pudo deshacer el cambio.')

  return { ...lista, porId, guardar, guardarCargas, cambiarEstado, borrar, deshacerEstado }
}

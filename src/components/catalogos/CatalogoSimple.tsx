import { Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { useAuth } from '@/hooks/useAuth'
import { useCatalogo } from '@/hooks/useCatalogo'
import { normalizar } from '@/lib/format'
import type { NombreCatalogo } from '@/lib/tipos'

type Registro = { id: string; nombre: string; activo: boolean } & Record<string, string | boolean>

export interface CampoCatalogo {
  clave: string
  label: string
  max: number
  requerido?: boolean
  multilinea?: boolean
  hint?: string
}

export interface ColumnaCatalogo {
  label: string
  render: (r: Registro) => ReactNode
}

/**
 * Pantalla de un catálogo simple: búsqueda, tabla, alta/edición en modal y
 * borrado. Los campos y columnas llegan por props; `extra` pinta algo más
 * dentro del modal de edición (por ejemplo, los pedidos del cliente).
 */
export function CatalogoSimple({
  tabla,
  titulo,
  descripcion,
  singular,
  campos,
  columnas,
  extra,
  incrustado = false,
}: {
  tabla: NombreCatalogo
  titulo: string
  descripcion: string
  /** 'proveedor', 'cliente'… en minúscula, para los mensajes. */
  singular: string
  campos: CampoCatalogo[]
  columnas: ColumnaCatalogo[]
  extra?: (r: Registro) => ReactNode
  /** Dentro de otra página: sin título grande. */
  incrustado?: boolean
}) {
  const { puedeEditar } = useAuth()
  const { data, loading, error, refetch, guardar, borrar } = useCatalogo(tabla)
  const registros = data as unknown as Registro[]

  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'nuevo' | Registro | null>(null)
  const [aBorrar, setABorrar] = useState<Registro | null>(null)
  const [borrando, setBorrando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return registros
    return registros.filter((r) => normalizar(campos.map((c) => String(r[c.clave] ?? '')).join(' ')).includes(q))
  }, [registros, busqueda, campos])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          {incrustado ? (
            <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
          ) : (
            <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
          )}
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        {puedeEditar && (
          <Button onClick={() => setModal('nuevo')}>
            <Plus /> Nuevo
          </Button>
        )}
      </div>

      {registros.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar"
            className="pl-9"
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <TableSkeleton columnas={[30, 25, 20, 15]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : registros.length === 0 ? (
        <Vacio titulo={`Sin ${titulo.toLowerCase()} todavía`} descripcion={puedeEditar ? 'Crea el primero con «Nuevo».' : undefined} />
      ) : filtrados.length === 0 ? (
        <Vacio titulo="Sin resultados" descripcion="Prueba con otra búsqueda." />
      ) : (
        <TablaScroll total={filtrados.length} clave={busqueda}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {columnas.map((c) => (
                    <th key={c.label} className="px-4 py-2.5 font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, limite).map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setModal(r)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setModal(r)
                      }
                    }}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    {columnas.map((c, i) => (
                      <td key={c.label} className={i === 0 ? 'px-4 py-2.5 font-medium text-foreground' : 'px-4 py-2.5 text-muted-foreground'}>
                        {c.render(r)}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <Badge tono={r.activo ? 'success' : 'neutral'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <FormCatalogo
        abierto={modal !== null}
        registro={modal === 'nuevo' ? null : modal}
        singular={singular}
        campos={campos}
        puedeEditar={puedeEditar}
        extra={extra}
        guardar={guardar}
        onCerrar={() => setModal(null)}
        onGuardado={() => {
          setModal(null)
          refetch()
        }}
        onBorrar={() => {
          setABorrar(modal === 'nuevo' ? null : modal)
          setModal(null)
        }}
      />

      <ConfirmModal
        abierto={aBorrar !== null}
        titulo={`Borrar ${singular}`}
        textoConfirmar="Borrar"
        procesando={borrando}
        mensaje={
          <>
            ¿Borrar <strong>{aBorrar?.nombre}</strong>? Si ya se usa en pedidos o productos, desactívalo en lugar de
            borrarlo.
          </>
        }
        onCancelar={() => setABorrar(null)}
        onConfirmar={async () => {
          if (!aBorrar) return
          setBorrando(true)
          const { error: err } = await borrar(aBorrar.id)
          setBorrando(false)
          if (err) toast.error(err)
          else {
            toast.success('Borrado.')
            refetch()
          }
          setABorrar(null)
        }}
      />
    </div>
  )
}

function FormCatalogo({
  abierto,
  registro,
  singular,
  campos,
  puedeEditar,
  extra,
  guardar,
  onCerrar,
  onGuardado,
  onBorrar,
}: {
  abierto: boolean
  /** null = crear */
  registro: Registro | null
  singular: string
  campos: CampoCatalogo[]
  puedeEditar: boolean
  extra?: (r: Registro) => ReactNode
  guardar: (id: string | null, datos: Record<string, unknown>) => Promise<{ error: string | null }>
  onCerrar: () => void
  onGuardado: () => void
  onBorrar: () => void
}) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setValores(Object.fromEntries(campos.map((c) => [c.clave, String(registro?.[c.clave] ?? '')])))
    setActivo(registro?.activo ?? true)
    setError(null)
    // Solo al abrir o cambiar de registro: una sincronización de fondo no debe borrar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, registro?.id, campos])

  async function onGuardar() {
    for (const c of campos) {
      if (c.requerido && !valores[c.clave]?.trim()) return setError(`${c.label} es obligatorio.`)
    }
    setGuardando(true)
    setError(null)
    const datos = Object.fromEntries(campos.map((c) => [c.clave, (valores[c.clave] ?? '').trim()]))
    const { error: err } = await guardar(registro?.id ?? null, { ...datos, activo })
    setGuardando(false)
    if (err) return setError(err)
    toast.success(registro ? 'Cambios guardados.' : 'Creado.')
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={registro ? `Editar ${singular}` : `Nuevo ${singular}`}
      onCerrar={onCerrar}
      footer={
        puedeEditar ? (
          <>
            {registro && (
              <Button variant="outline" onClick={onBorrar} disabled={guardando}>
                <Trash2 className="text-destructive" /> Borrar
              </Button>
            )}
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : registro ? 'Guardar' : 'Crear'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        )
      }
    >
      <fieldset disabled={!puedeEditar} className="space-y-4">
        {campos.map((c, i) => (
          <Field key={c.clave} label={c.requerido ? `${c.label} *` : c.label} hint={c.hint}>
            {c.multilinea ? (
              <Textarea
                value={valores[c.clave] ?? ''}
                maxLength={c.max}
                onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
              />
            ) : (
              <Input
                value={valores[c.clave] ?? ''}
                maxLength={c.max}
                autoFocus={i === 0 && !registro}
                onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
              />
            )}
          </Field>
        ))}
        {registro && (
          <Field label="Estado" hint="Un registro inactivo no se ofrece al crear pedidos o productos nuevos.">
            <Select value={activo ? '1' : '0'} onChange={(e) => setActivo(e.target.value === '1')}>
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </Select>
          </Field>
        )}
        {error && <ErrorBox mensaje={error} />}
      </fieldset>
      {registro && extra?.(registro)}
    </Modal>
  )
}

import { ExternalLink, FileText, Loader2, Star, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { useArchivos, urlArchivo, urlMiniatura } from '@/hooks/useArchivos'
import { formatFecha } from '@/lib/format'

const ACEPTA_FOTOS = 'image/*'
const ACEPTA_DOCUMENTOS = 'application/pdf,image/*,.xls,.xlsx,.doc,.docx,.csv,.txt'

function formatTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Archivos de Drive de un producto (galería de fotos, con foto principal) o de
 * un pedido (lista de documentos). Con `id` null avisa que hay que guardar
 * primero. Subir y borrar solo lo ve quien puede editar.
 */
export function Adjuntos({
  entidad,
  id,
  puedeEditar,
}: {
  entidad: 'producto' | 'pedido'
  id: string | null
  puedeEditar: boolean
}) {
  const esFotos = entidad === 'producto'
  const { data, loading, error, refetch, subir, marcarPrincipal, borrar } = useArchivos(entidad, id)
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function onElegir(archivos: FileList | null) {
    if (!archivos?.length) return
    setSubiendo(true)
    let ok = 0
    for (const f of Array.from(archivos)) {
      const { error: err } = await subir(f)
      if (err) toast.error(err)
      else ok++
    }
    setSubiendo(false)
    if (entrada.current) entrada.current.value = ''
    if (ok) {
      toast.success(ok === 1 ? 'Archivo subido.' : `${ok} archivos subidos.`)
      refetch()
    }
  }

  async function accion(archivoId: string, fn: (id: string) => Promise<{ error: string | null }>, okMsg: string) {
    setOcupado(archivoId)
    const { error: err } = await fn(archivoId)
    setOcupado(null)
    if (err) toast.error(err)
    else {
      toast.success(okMsg)
      refetch()
    }
  }

  if (id === null) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        Guarda primero para poder adjuntar {esFotos ? 'fotos' : 'documentos'}.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {puedeEditar && (
        <div>
          <input
            ref={entrada}
            type="file"
            multiple
            hidden
            accept={esFotos ? ACEPTA_FOTOS : ACEPTA_DOCUMENTOS}
            onChange={(e) => void onElegir(e.target.files)}
          />
          <Button variant="outline" size="sm" disabled={subiendo} onClick={() => entrada.current?.click()}>
            {subiendo ? <Loader2 className="animate-spin" /> : <Upload />}
            {subiendo ? 'Subiendo…' : esFotos ? 'Agregar fotos' : 'Adjuntar documento'}
          </Button>
          <span className="ml-3 text-xs text-muted-foreground">Máximo 10 MB por archivo.</span>
        </div>
      )}

      {error ? (
        <ErrorBox mensaje={error} />
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Cargando archivos…</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{esFotos ? 'Sin fotos.' : 'Sin documentos adjuntos.'}</p>
      ) : esFotos ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-md border border-border bg-secondary">
              <a href={urlArchivo(a.driveId)} target="_blank" rel="noreferrer" title={a.nombre}>
                <img
                  src={urlMiniatura(a.driveId, 400)}
                  alt={a.nombre}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full object-cover"
                />
              </a>
              {a.principal && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Star className="size-3" /> Principal
                </span>
              )}
              {puedeEditar && (
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-black/55 p-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  {!a.principal && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-white hover:bg-white/20 hover:text-white"
                      title="Marcar como principal"
                      disabled={ocupado === a.id}
                      onClick={() => void accion(a.id, marcarPrincipal, 'Foto principal actualizada.')}
                    >
                      <Star />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-white hover:bg-white/20 hover:text-white"
                    title="Borrar"
                    disabled={ocupado === a.id}
                    onClick={() => {
                      if (window.confirm(`¿Borrar ${a.nombre}?`)) void accion(a.id, borrar, 'Archivo borrado.')
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <a
                  href={urlArchivo(a.driveId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate font-medium text-foreground hover:underline"
                >
                  <span className="truncate">{a.nombre}</span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {formatTamano(a.bytes)} · {formatFecha(a.fecha)} · {a.subidoNombre || a.subidoPor}
                </p>
              </div>
              {puedeEditar && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Borrar"
                  disabled={ocupado === a.id}
                  onClick={() => {
                    if (window.confirm(`¿Borrar ${a.nombre}?`)) void accion(a.id, borrar, 'Archivo borrado.')
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

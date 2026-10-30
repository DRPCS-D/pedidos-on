import { urlMiniatura } from '@/hooks/useArchivos'
import { useProductos } from '@/hooks/useProductos'
import { fotoDeColor } from '@/lib/fotos'

/** Miniatura de un producto en un color: la foto de ese color o, si no tiene, la general. Sin foto no dibuja nada. */
export function FotoColor({ productoId, color, lado = 36 }: { productoId: string; color: string; lado?: number }) {
  const { porId } = useProductos()
  const driveId = fotoDeColor(porId.get(productoId), color)
  if (!driveId) return null
  return (
    <img
      src={urlMiniatura(driveId, 120)}
      alt=""
      title={color || undefined}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{ width: lado, height: lado }}
      className="shrink-0 rounded-md border border-border object-cover"
    />
  )
}

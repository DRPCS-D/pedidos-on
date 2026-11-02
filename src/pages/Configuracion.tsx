import { useState } from 'react'
import { PlazosPausas } from '@/components/catalogos/PlazosPausas'
import { TextosDocumentos } from '@/components/catalogos/TextosDocumentos'
import { cn } from '@/lib/utils'

type Pestana = 'plazos' | 'documentos'

/** Ajustes generales de la app: plazos y pausas de la fábrica y textos de los documentos. */
export default function Configuracion() {
  const [pestana, setPestana] = useState<Pestana>('plazos')

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-border">
        {(
          [
            ['plazos', 'Plazos y pausas de la fábrica'],
            ['documentos', 'Documentos (PDF y Excel)'],
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

      {pestana === 'plazos' ? <PlazosPausas /> : <TextosDocumentos />}
    </div>
  )
}

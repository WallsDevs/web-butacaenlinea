import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChipTarjetaNfc } from '../../lib/api/endpoints';
import { GrabarTarjetaNfc } from './GrabarTarjetaNfc';
import ui from '../../components/ui/ui.module.css';
import css from './AdminTarjetasNfc.module.css';

export function PrepararGrabacionNfc({ codigoPublico, operador }: { codigoPublico: string; operador: number }) {
  const [abierta, setAbierta] = useState(false);
  const [verCodigo, setVerCodigo] = useState(false);
  const [aviso, setAviso] = useState('');
  const chip = useQuery({
    queryKey: ['chip-tarjeta-nfc', operador, abierta ? codigoPublico : ''],
    queryFn: ({ signal }) => getChipTarjetaNfc(codigoPublico, signal),
    enabled: abierta,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  async function copiar(interno: string) {
    try {
      await navigator.clipboard.writeText(interno);
      setAviso('Código interno copiado.');
    } catch {
      setAviso('Selecciona el código para copiarlo.');
    }
  }
  return (
    <section className={css.operacion} aria-labelledby="chip-fisico">
      <div className={css.tituloFicha}>
        <h3 id="chip-fisico">Chip de la tarjeta</h3>
        <button type="button" className={ui.btnSecondary} aria-expanded={abierta} onClick={() => {
          setAbierta(!abierta); setVerCodigo(false); setAviso('');
        }}>{abierta ? 'Cerrar grabación' : 'Preparar grabación'}</button>
      </div>
      {abierta && (chip.isError
        ? <p role="alert">No se pudo cargar el código del chip. <button className={ui.btnGhost} onClick={() => void chip.refetch()}>Reintentar</button></p>
        : chip.data ? <>
          <GrabarTarjetaNfc codigoPublico={codigoPublico} codigoInterno={chip.data.codigoInterno} />
          <details className={css.grabadorExterno} onToggle={(e) => setVerCodigo(e.currentTarget.open)}>
            <summary>Ver código para grabador externo</summary>
            {verCodigo && <>
              <p>En el grabador, crea un único registro de texto NDEF y pega este código interno.</p>
              <code>{chip.data.codigoInterno}</code>
              <button type="button" className={ui.btnGhost} onClick={() => void copiar(chip.data.codigoInterno)}>Copiar código interno</button>
              {aviso && <p role="status">{aviso}</p>}
            </>}
          </details>
        </> : <p role="status">Cargando datos del chip…</p>)}
    </section>
  );
}

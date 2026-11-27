import type { LoteNfc } from '../../lib/api/endpoints';

export function descargarCodigos(lote: LoteNfc, paraChips: boolean) {
  const encabezado = paraChips ? 'codigoPublico,codigoInterno' : 'codigoPublico';
  const filas = lote.tarjetas.map((tarjeta) => {
    const campos = paraChips ? [tarjeta.codigoPublico, tarjeta.codigoInterno] : [tarjeta.codigoPublico];
    return campos.map((campo) => `"${campo.replaceAll('"', '""')}"`).join(',');
  });
  const archivo = new Blob([[encabezado, ...filas, ''].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `butaca-${lote.solicitudId}-${paraChips ? 'chips' : 'publicos'}.csv`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

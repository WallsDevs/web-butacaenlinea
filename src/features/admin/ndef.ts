interface RegistroNdef {
  recordType: string;
  encoding?: string;
  data?: DataView | null;
}

interface LectorNdef {
  scan(opciones: { signal: AbortSignal }): Promise<void>;
  write(mensaje: { records: { recordType: 'text'; encoding: 'utf-8'; data: string }[] }, opciones: { overwrite: false; signal: AbortSignal }): Promise<void>;
  onreading: ((evento: { message: { records: readonly RegistroNdef[] } }) => void) | null;
  onreadingerror: (() => void) | null;
}

export function lectorNfcDisponible() {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { NDEFReader?: new () => LectorNdef }).NDEFReader;
}

export function admiteGrabacionNfc(): boolean {
  const Lector = lectorNfcDisponible();
  return Boolean(Lector && window.isSecureContext && window.top === window &&
    typeof Lector.prototype.write === 'function' && typeof Lector.prototype.scan === 'function');
}

export function codigoDelMensaje(registros: readonly RegistroNdef[]): string | null {
  const [registro] = registros;
  if (registros.length !== 1 || registro.recordType !== 'text' || !registro.data || registro.data.byteLength > 512) return null;
  try {
    let formato = registro.encoding?.toLowerCase() || 'utf-8';
    if (formato === 'utf-16') {
      // NDEF emplea big-endian salvo que la marca de orden de bytes indique little-endian.
      formato = registro.data.getUint16(0) === 0xfffe ? 'utf-16le' : 'utf-16be';
    }
    const texto = new TextDecoder(formato, { fatal: true }).decode(registro.data);
    if (!texto || texto.length > 128 || texto !== texto.trim() || /[\p{Cc}\p{Cf}]/u.test(texto)) return null;
    return texto;
  } catch {
    return null;
  }
}

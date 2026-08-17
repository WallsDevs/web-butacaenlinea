/**
 * Verificación LOCAL del QR (PWA del chófer, sin señal): valida la firma
 * ES256 del JWS con la clave pública del servidor usando WebCrypto.
 * El veredicto final (duplicado/anulado) siempre lo da el servidor al
 * sincronizar — esto solo pre-valida en frío.
 */

export interface ClaimsQr {
  jti: string;
  s: string;
  a: string;
  l: string;
  iat: number;
  exp: number;
}

function b64urlABytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function importarClavePublica(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = b64urlABytes(b64.replace(/\+/g, '-').replace(/\//g, '_'));
  return crypto.subtle.importKey(
    'spki',
    der.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
}

export type VerificacionLocal =
  | { ok: true; claims: ClaimsQr }
  | { ok: false; error: 'formato' | 'firma' | 'vencido' };

export async function verificarJwsLocal(token: string, clave: CryptoKey): Promise<VerificacionLocal> {
  const partes = token.split('.');
  if (partes.length !== 3) return { ok: false, error: 'formato' };
  const [header, payload, firma] = partes;
  try {
    const data = new TextEncoder().encode(`${header}.${payload}`);
    // En JWS ES256 la firma es r||s crudo (64 bytes) — el formato que espera SubtleCrypto
    const valida = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      clave,
      b64urlABytes(firma).buffer as ArrayBuffer,
      data
    );
    if (!valida) return { ok: false, error: 'firma' };
    const claims = JSON.parse(new TextDecoder().decode(b64urlABytes(payload))) as ClaimsQr;
    if (claims.exp && claims.exp * 1000 < Date.now()) return { ok: false, error: 'vencido' };
    return { ok: true, claims };
  } catch {
    return { ok: false, error: 'formato' };
  }
}

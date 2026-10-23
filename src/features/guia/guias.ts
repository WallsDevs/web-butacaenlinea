/**
 * Guías paso a paso sobre la web real: cada paso lleva a una pantalla y
 * resalta una parte (por su `data-guia`). Un paso sin `objetivo` es una
 * explicación sin resaltar nada (lo que pasa después de tocar, p. ej.).
 */
export interface PasoGuia {
  /** Pantalla donde ocurre el paso: la guía navega sola hasta ella. */
  ruta: string;
  /** El `data-guia` de lo que se resalta. */
  objetivo?: string;
  titulo: string;
  texto: string;
}
export interface Guia {
  id: string;
  titulo: string;
  pasos: PasoGuia[];
}

export const GUIAS: Record<string, Guia> = {
  comprar: {
    id: 'comprar',
    titulo: 'Comprar un pasaje',
    pasos: [
      { ruta: '/cuenta', objetivo: 'buscar-ciudades', titulo: 'De dónde sales y a dónde vas', texto: 'Toca cada ciudad para cambiarla. Con el botón de las flechas inviertes el sentido del viaje.' },
      { ruta: '/cuenta', objetivo: 'buscar-dias', titulo: 'Escoge el día', texto: 'Hoy y los próximos días. Las salidas de ese día aparecen más abajo.' },
      { ruta: '/cuenta', objetivo: 'buscar-pasajeros', titulo: '¿Cuántos viajan?', texto: 'Escoges un puesto por cada pasajero.' },
      { ruta: '/cuenta', objetivo: 'buscar-salidas', titulo: 'Toca la salida que te sirva', texto: 'Se abre el mapa del bus: toca tus puestos libres y luego «Pagar boleto». Quedan apartados para ti 5 minutos mientras pagas.' },
      { ruta: '/cuenta', titulo: 'Paga', texto: 'Escribe el nombre y la cédula de cada pasajero y paga con Pago Móvil, Zelle o el saldo de tu wallet.' },
      { ruta: '/cuenta', objetivo: 'nav-boletos', titulo: 'Tu boleto queda aquí', texto: 'En «Mis boletos» está tu boleto con su QR. Al abordar lo muestras en el teléfono, aunque no tengas señal.' },
    ],
  },
  recargar: {
    id: 'recargar',
    titulo: 'Recargar tu wallet',
    pasos: [
      { ruta: '/cuenta/wallet', objetivo: 'wallet-saldo', titulo: 'Este es tu saldo', texto: 'Con él pagas las busetas escaneando su QR, y también tus pasajes.' },
      { ruta: '/cuenta/wallet', objetivo: 'wallet-metodos', titulo: 'La primera vez, guarda tu Pago Móvil', texto: 'En «Mis métodos de pago» guardas el Pago Móvil desde el que vas a pagar. Solo se hace una vez.' },
      { ruta: '/cuenta/wallet', objetivo: 'wallet-recargar', titulo: 'Toca «Recargar»', texto: 'Verás la cuenta de Butaca para el Pago Móvil, con botones para copiar el teléfono y la cédula.' },
      { ruta: '/cuenta/wallet', titulo: 'Haz el Pago Móvil y repórtalo', texto: 'Desde tu banco envía el monto. Luego escribe el monto y la referencia, adjunta la captura y toca reportar.' },
      { ruta: '/cuenta/wallet', objetivo: 'wallet-movimientos', titulo: 'Aquí ves tu recarga', texto: 'Aparece como «Por confirmar» hasta que verificamos el pago; entonces se suma a tu saldo.' },
    ],
  },
  'pagar-buseta': {
    id: 'pagar-buseta',
    titulo: 'Pagar la buseta',
    pasos: [
      { ruta: '/cuenta/wallet', objetivo: 'wallet-saldo', titulo: 'Necesitas saldo', texto: 'El pasaje de la buseta se descuenta de tu wallet. Si no tienes, recarga primero.' },
      { ruta: '/cuenta/wallet', objetivo: 'wallet-pagar', titulo: 'Toca «Pagar pasaje — escanear QR»', texto: 'Apunta la cámara al QR de la buseta: está pegado adentro o lo muestra el colector.' },
      { ruta: '/cuenta/wallet', titulo: 'Dinos dónde te subes y te bajas', texto: 'Si la ruta cobra por tramos, elige tu parada de subida y de bajada; el precio sale de ahí. Confirma y listo: el colector ve tu pago al instante.' },
      { ruta: '/cuenta/wallet', objetivo: 'nav-busetas', titulo: '¿Por dónde viene tu buseta?', texto: 'En «Busetas» ves en el mapa las busetas en servicio de cada ruta.' },
    ],
  },
};

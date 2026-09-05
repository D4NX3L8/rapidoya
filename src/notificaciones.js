'use strict';

/**
 * notificaciones.js — RF-5
 * -------------------------
 * Regla de negocio clave (repetida dos veces en el enunciado): a diferencia
 * del inventario, el fallo de UN canal NO cancela nada. El pedido ya está
 * pagado y en camino con repartidor asignado; lo único que hace esta etapa
 * es AVISAR, y necesitamos un informe completo de qué canal funcionó y
 * cuál no, no un "todo o nada".
 *
 * Por eso esta etapa usa Promise.allSettled y no Promise.all:
 *   - Promise.all() aborta apenas el PRIMER fallo y descarta el resto,
 *     perfecto para inventario.js (ahí sí queremos cancelar rápido).
 *   - Promise.allSettled() espera a los 3 canales SIN IMPORTAR si alguno
 *     falla, y nos da el resultado (éxito o motivo de fallo) de cada uno.
 *     Es justo lo que pide el enunciado: "un informe completo".
 */

const { delayAleatorio, fallaConProbabilidad } = require('./simulador');
const { ErrorNotificacion } = require('./errores');

const RETARDO_MIN_MS = 300;
const RETARDO_MAX_MS = 1000;
const PROBABILIDAD_FALLO = 30; // % — "los servicios de notificación son poco confiables"

/**
 * Cada función de envío simula su propio canal de forma completamente
 * independiente: tiempo propio y probabilidad de fallo propia. Que se
 * parezcan tanto entre sí es intencional: así se ve claro que la única
 * diferencia real entre canales es el medio, no la lógica.
 */
async function enviarCorreo(destinatario, mensaje) {
  await delayAleatorio(RETARDO_MIN_MS, RETARDO_MAX_MS);
  if (fallaConProbabilidad(PROBABILIDAD_FALLO)) {
    throw new Error(`El servidor de correo no respondió al enviar a ${destinatario}`);
  }
  return { canal: 'correo', destinatario, mensaje };
}

async function enviarSMS(numero, mensaje) {
  await delayAleatorio(RETARDO_MIN_MS, RETARDO_MAX_MS);
  if (fallaConProbabilidad(PROBABILIDAD_FALLO)) {
    throw new Error(`El operador móvil rechazó el SMS a ${numero}`);
  }
  return { canal: 'sms', destinatario: numero, mensaje };
}

async function enviarPush(tokenDispositivo, mensaje) {
  await delayAleatorio(RETARDO_MIN_MS, RETARDO_MAX_MS);
  if (fallaConProbabilidad(PROBABILIDAD_FALLO)) {
    throw new Error(`El dispositivo ${tokenDispositivo} no está disponible para push`);
  }
  return { canal: 'push', destinatario: tokenDispositivo, mensaje };
}

/**
 * Punto de entrada de esta etapa. Recibe el pedido completo (para tomar
 * los 3 canales de contacto del cliente) y devuelve SIEMPRE un informe,
 * nunca lanza un error solo porque un canal falló individualmente.
 */
async function notificarCliente(pedido) {
  const mensaje = `Tu pedido #${pedido.id} va en camino`;
  const { correo, sms, push } = pedido.canalesContacto;
  const nombresDeCanal = ['correo', 'sms', 'push'];

  // Los 3 envíos se lanzan a la vez (ninguno espera al anterior) y
  // Promise.allSettled espera a que los 3 terminen, sin que uno cancele
  // a los demás.
  const resultados = await Promise.allSettled([
    enviarCorreo(correo, mensaje),
    enviarSMS(sms, mensaje),
    enviarPush(push, mensaje),
  ]);

  const informe = resultados.map((resultado, indice) => {
    if (resultado.status === 'fulfilled') {
      return { canal: nombresDeCanal[indice], estado: 'enviado' };
    }
    return {
      canal: nombresDeCanal[indice],
      estado: 'fallido',
      motivo: resultado.reason.message,
    };
  });

  const algunCanalFunciono = informe.some((item) => item.estado === 'enviado');

  if (!algunCanalFunciono) {
    // Ningún canal funcionó. El pedido NO se cancela (ya se cocinó, se
    // pagó y salió con el repartidor), pero sí queremos un registro fuerte
    // de que el cliente se quedó sin ninguna notificación, para que
    // soporte pueda hacer seguimiento manual.
    throw new ErrorNotificacion(
      { pedidoId: pedido.id, informe },
      'Los 3 canales de notificación fallaron simultáneamente',
    );
  }

  return { exitoso: true, informe };
}

module.exports = { notificarCliente, enviarCorreo, enviarSMS, enviarPush };
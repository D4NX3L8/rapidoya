'use strict';

/**
 * errores.js
 * ----------
 * RF-7 exige que cada error registrado responda tres preguntas: ¿en qué
 * etapa ocurrió?, ¿con qué datos se trabajaba?, y ¿qué causa exacta lo
 * produjo? En vez de usar Error genérico con un mensaje suelto, creamos
 * una clase base que OBLIGA a llenar esos tres campos, y una subclase por
 * cada etapa del negocio. Así:
 *   - El código de cada etapa no puede "olvidarse" de dar contexto: la
 *     forma del constructor se lo exige.
 *   - El orquestador puede distinguir de qué etapa vino el error usando
 *     `instanceof` o el nombre de la clase, sin tener que leer strings.
 */

class ErrorEtapaPedido extends Error {
  /**
   * @param {string} mensajeCliente - Mensaje entendible para mostrarle al
   *   cliente final (ej. "Lo sentimos, tu banco rechazó el pago").
   * @param {object} contexto
   * @param {string} contexto.etapa - Nombre corto de la etapa donde ocurrió.
   * @param {*} contexto.datos - Con qué datos se estaba trabajando (el
   *   pedido, el producto, el monto, etc.) al momento del fallo.
   * @param {string} contexto.causa - La causa exacta y técnica del fallo,
   *   distinta del mensaje amigable para el cliente.
   */
  constructor(mensajeCliente, { etapa, datos, causa }) {
    super(mensajeCliente);
    this.name = this.constructor.name; // ej. "ErrorPago", útil en logs
    this.etapa = etapa;
    this.datos = datos;
    this.causa = causa;
    this.timestamp = new Date().toISOString();

    // Evita que el stack trace apunte a este constructor genérico y en
    // cambio empiece en el punto real donde se lanzó el error (más útil
    // para debugging que "todo apunta siempre a errores.js").
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** RF-1: restaurante cerrado o fuera de cobertura. */
class ErrorRestaurante extends ErrorEtapaPedido {
  constructor(datos, causa) {
    super('Lo sentimos, el restaurante no está disponible en este momento.', {
      etapa: 'verificacion-restaurante',
      datos,
      causa,
    });
  }
}

/** RF-2: al menos un producto del pedido está agotado. */
class ErrorInventario extends ErrorEtapaPedido {
  constructor(datos, causa) {
    super('Lo sentimos, uno de los productos de tu pedido no está disponible.', {
      etapa: 'validacion-inventario',
      datos,
      causa,
    });
  }
}

/** RF-3: fondos insuficientes, timeout del banco, o tarjeta bloqueada. */
class ErrorPago extends ErrorEtapaPedido {
  constructor(datos, causa) {
    super('Lo sentimos, no pudimos procesar tu pago.', {
      etapa: 'procesamiento-pago',
      datos,
      causa,
    });
  }
}

/** RF-4: no hay repartidores disponibles en la zona. */
class ErrorRepartidor extends ErrorEtapaPedido {
  constructor(datos, causa) {
    super('Lo sentimos, no encontramos un repartidor disponible en tu zona.', {
      etapa: 'asignacion-repartidor',
      datos,
      causa,
    });
  }
}

/**
 * RF-5: fallo de notificación. A diferencia de las demás, esta clase se usa
 * solo para dejar constancia (el pedido YA se entregó), nunca para cancelar
 * nada. Por eso su mensaje no dice "lo sentimos, tu pedido falló" sino que
 * aclara que el pedido sí se confirmó.
 */
class ErrorNotificacion extends ErrorEtapaPedido {
  constructor(datos, causa) {
    super('Tu pedido fue confirmado, pero tuvimos problemas para notificarte.', {
      etapa: 'notificacion-cliente',
      datos,
      causa,
    });
  }
}

/**
 * Registro interno de errores (RF-7). En un sistema real esto escribiría a
 * un archivo de log o a un servicio externo; aquí, para mantenernos sin
 * dependencias, lo dejamos en consola pero con un formato fijo y completo
 * para que el equipo de soporte (según el enunciado) no termine odiándonos
 * por errores que solo dicen "Error".
 */
function registrarError(error) {
  const registro = {
    fecha: error.timestamp || new Date().toISOString(),
    etapa: error.etapa || 'desconocida',
    datos: error.datos ?? null,
    causa: error.causa || error.message,
  };

  console.error('----- ERROR REGISTRADO -----');
  console.error(`Etapa : ${registro.etapa}`);
  console.error(`Datos : ${JSON.stringify(registro.datos)}`);
  console.error(`Causa : ${registro.causa}`);
  console.error(`Fecha : ${registro.fecha}`);
  console.error('-----------------------------');

  return registro;
}

module.exports = {
  ErrorEtapaPedido,
  ErrorRestaurante,
  ErrorInventario,
  ErrorPago,
  ErrorRepartidor,
  ErrorNotificacion,
  registrarError,
};
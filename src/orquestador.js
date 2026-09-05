'use strict';

/**
 * orquestador.js — RF-6
 * -----------------------
 * Exigencia textual del gerente técnico: poder leer esta función "de arriba
 * hacia abajo como una receta de cocina", sin zigzag ni pirámides de
 * callbacks anidados, aunque por debajo todo esté diferido en el tiempo.
 * Esa frase es la pista de que esto se escribe con async/await: cada
 * `await` PARECE código síncrono normal, pero no bloquea el hilo de Node
 * mientras espera al restaurante, al banco, etc.
 *
 * CONTRATO que este archivo asume de los módulos de tus compañeros
 * (compártanlo para que todos implementen exactamente esta firma):
 *
 *   restaurante.js -> verificarRestauranteAsync(nombreRestaurante)
 *                     Promise<{ nombre, tiempoPreparacion, abierto }>
 *
 *   inventario.js  -> validarInventario(productos)
 *                     Promise<Array<{ producto, cantidad, disponible: true }>>
 *
 *   pago.js        -> procesarPagoAsync(monto, datosCliente)
 *                     Promise<{ idTransaccion, monto, estado }>
 *                  -> reversarPagoAsync(idTransaccion)
 *                     Promise<{ idTransaccion, reversado: true }>
 *
 *   repartidor.js  -> asignarRepartidorAsync(zonaEntrega)
 *                     Promise<{ idRepartidor, nombre, tiempoEstimado }>
 *
 * Todas deben RECHAZAR (throw) con una instancia de las clases de
 * errores.js cuando algo falla — nunca con un string plano — para que el
 * registro de errores (RF-7) tenga etapa/datos/causa disponibles.
 */

const { verificarRestauranteAsync } = require('./restaurante');
const { validarInventario } = require('./inventario');
const { procesarPagoAsync, reversarPagoAsync } = require('./pago');
const { asignarRepartidorAsync } = require('./repartidor');
const { notificarCliente } = require('./notificaciones');
const { registrarError } = require('./errores');

/**
 * Orquesta las 5 etapas del pedido, en orden, con async/await.
 * Nótese que la función se lee literalmente como los pasos del enunciado:
 * paso 1, paso 2, paso 3... Cada paso está envuelto en su propio
 * try/catch porque cada uno necesita una reacción distinta si falla
 * (cancelar, revertir un pago, o simplemente dejar constancia).
 */
async function procesarPedido(pedido) {
  const duraciones = {};

  // ---------- Paso 1: verificar restaurante ----------
  let infoRestaurante;
  let inicioEtapa = Date.now();
  try {
    infoRestaurante = await verificarRestauranteAsync(pedido.restaurante);
  } catch (error) {
    registrarError(error);
    return construirReporteFallido(pedido, error, duraciones);
  } finally {
    duraciones.verificarRestaurante = Date.now() - inicioEtapa;
  }

  // ---------- Paso 2: validar inventario ----------
  inicioEtapa = Date.now();
  try {
    // No usamos el resultado directamente aquí: si esta promesa se
    // resuelve, significa que TODOS los productos estaban disponibles.
    // Si uno solo falla, validarInventario() debe rechazar de inmediato
    // (esa lógica de "cancelación temprana" vive en inventario.js, no aquí).
    await validarInventario(pedido.productos);
  } catch (error) {
    registrarError(error);
    return construirReporteFallido(pedido, error, duraciones);
  } finally {
    duraciones.validarInventario = Date.now() - inicioEtapa;
  }

  // ---------- Paso 3: procesar pago ----------
  let pago;
  inicioEtapa = Date.now();
  try {
    pago = await procesarPagoAsync(pedido.montoTotal, pedido.datosCliente);
  } catch (error) {
    registrarError(error);
    return construirReporteFallido(pedido, error, duraciones);
  } finally {
    duraciones.procesarPago = Date.now() - inicioEtapa;
  }

  // ---------- Paso 4: asignar repartidor ----------
  let repartidor;
  inicioEtapa = Date.now();
  try {
    repartidor = await asignarRepartidorAsync(pedido.zonaEntrega);
  } catch (error) {
    // Compensación (RF-4): el pago YA se cobró, así que hay que
    // devolverlo antes de reportar el fallo al cliente. Esta lógica vive
    // AQUÍ, en el orquestador, y no dentro de repartidor.js, porque
    // repartidor.js no tiene ninguna razón para conocer nada sobre el
    // pago: el orquestador es el único punto que ve ambas etapas a la vez.
    try {
      await reversarPagoAsync(pago.idTransaccion);
    } catch (errorReversion) {
      // Si la reversión también falla, es un caso grave (cobramos y no
      // pudimos devolver): se registra aparte para que soporte lo vea.
      registrarError(errorReversion);
    }
    registrarError(error);
    return construirReporteFallido(pedido, error, duraciones);
  } finally {
    duraciones.asignarRepartidor = Date.now() - inicioEtapa;
  }

  // ---------- Paso 5: notificar al cliente ----------
  let resultadoNotificacion;
  inicioEtapa = Date.now();
  try {
    resultadoNotificacion = await notificarCliente(pedido);
  } catch (error) {
    // A diferencia de los pasos anteriores, un fallo aquí NO cancela el
    // pedido: ya está pagado, confirmado y en camino. Solo se deja
    // constancia del problema y se sigue de largo.
    registrarError(error);
    resultadoNotificacion = { exitoso: false, informe: error.datos?.informe ?? [] };
  } finally {
    duraciones.notificarCliente = Date.now() - inicioEtapa;
  }

  return construirReporteExitoso(
    pedido,
    { infoRestaurante, pago, repartidor, resultadoNotificacion },
    duraciones,
  );
}

function construirReporteExitoso(pedido, datos, duraciones) {
  return {
    pedidoId: pedido.id,
    estado: 'en-camino',
    restaurante: datos.infoRestaurante,
    pago: datos.pago,
    repartidor: datos.repartidor,
    notificacion: datos.resultadoNotificacion,
    duracionesMs: duraciones,
  };
}

function construirReporteFallido(pedido, error, duraciones) {
  return {
    pedidoId: pedido.id,
    estado: 'cancelado',
    etapaFallida: error.etapa || 'desconocida',
    mensajeParaElCliente: error.message,
    duracionesMs: duraciones,
  };
}

/**
 * Imprime el resumen que pide RF-6: estado final, duración de cada etapa,
 * y resultado por canal de notificación. Se separa de procesarPedido()
 * para que la función principal siga siendo pura "receta de pasos" y no
 * se mezcle con lógica de presentación en consola.
 */
function imprimirResumenPedido(reporte) {
  console.log('\n========== RESUMEN DEL PEDIDO ==========');
  console.log(`Pedido        : #${reporte.pedidoId}`);
  console.log(`Estado final  : ${reporte.estado}`);

  if (reporte.estado === 'cancelado') {
    console.log(`Etapa fallida : ${reporte.etapaFallida}`);
    console.log(`Mensaje       : ${reporte.mensajeParaElCliente}`);
  }

  console.log('Duración por etapa (ms):');
  for (const [etapa, ms] of Object.entries(reporte.duracionesMs)) {
    console.log(`  - ${etapa}: ${ms} ms`);
  }

  if (reporte.notificacion) {
    console.log('Notificaciones:');
    for (const item of reporte.notificacion.informe) {
      const detalle = item.estado === 'enviado' ? 'OK' : `FALLÓ (${item.motivo})`;
      console.log(`  - ${item.canal}: ${detalle}`);
    }
  }
  console.log('=========================================\n');
}

module.exports = { procesarPedido, imprimirResumenPedido };
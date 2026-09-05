'use strict';

/**
 * simulador.js
 * ------------
 * Este módulo NO representa ninguna etapa del negocio: es infraestructura
 * de prueba compartida por TODOS los demás módulos (restaurante, inventario,
 * pago, repartidor, notificaciones). Centralizarlo aquí evita que cada quien
 * invente su propia forma de "esperar" o de "fallar aleatoriamente", lo cual
 * haría que las probabilidades del enunciado no se cumplieran de manera
 * consistente en todo el sistema.
 */

/**
 * Devuelve una promesa que se resuelve después de `ms` milisegundos.
 * Es el bloque de construcción más básico: todo lo demás en este archivo
 * (y en los módulos de las demás etapas) se apoya en esta función para
 * "esperar" sin bloquear el hilo de Node.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simula el tiempo de una operación externa (banco, restaurante, etc.)
 * eligiendo un retardo aleatorio entre minMs y maxMs, ambos inclusive.
 * Se usa en vez de un delay fijo porque el enunciado exige que cada
 * etapa tenga un RANGO de tiempo, no un tiempo constante (así el
 * comportamiento se parece más a servicios reales, donde nunca se
 * tarda exactamente lo mismo dos veces).
 */
function delayAleatorio(minMs, maxMs) {
  const duracion = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(duracion);
}

/**
 * Decide si una operación debe fallar, según un porcentaje (0-100).
 * Ejemplo: fallaConProbabilidad(20) -> true el 20% de las veces.
 *
 * Se centraliza esta función (en vez de que cada módulo escriba su propio
 * "Math.random() < 0.2") para que la convención sea la misma en todo el
 * proyecto: SIEMPRE se recibe un porcentaje legible (20, no 0.2), lo cual
 * hace que el código de cada etapa se lea igual que las reglas de negocio
 * del enunciado ("probabilidad de fallo: 20%").
 */
function fallaConProbabilidad(porcentajeDeFallo) {
  return Math.random() * 100 < porcentajeDeFallo;
}

/**
 * Elige aleatoriamente un elemento de un arreglo. Pensada para los casos
 * donde una etapa puede fallar por MÁS DE UNA causa distinta (por ejemplo,
 * el pago: fondos insuficientes, timeout del banco, o tarjeta bloqueada).
 * Cuando la etapa decide que debe fallar, usa esta función para elegir
 * CUÁL de esas causas fue, en vez de hardcodear siempre la primera.
 */
function elegirCausaAleatoria(posiblesCausas) {
  const indice = Math.floor(Math.random() * posiblesCausas.length);
  return posiblesCausas[indice];
}

module.exports = {
  delay,
  delayAleatorio,
  fallaConProbabilidad,
  elegirCausaAleatoria,
};
'use strict';

const { delayAleatorio,fallaConProbabilidad, } = require('./simulador');

const { ErrorRepartidor, } = require('./errores');

/**
 * RF-4: Asignación de repartidor.
 *
 * Busca un repartidor disponible para la zona de entrega.
 * La operación es asíncrona porque simula el tiempo que
 * tardaría un servicio externo en realizar la búsqueda.
 *
 * @param {string} zonaEntrega - Zona donde se realizará la entrega.
 * @returns {Promise<object>} Información del repartidor asignado.
 * @throws {ErrorRepartidor} Cuando no hay repartidores disponibles.
 */
async function asignarRepartidorAsync(zonaEntrega) {

  // Simular el tiempo que tarda el sistema en buscar
  // un repartidor disponible.
  await delayAleatorio(800, 1800);

  // Simular una posibilidad del 20% de no encontrar
  // un repartidor disponible.
  if (fallaConProbabilidad(20)) {
    throw new ErrorRepartidor(
      { zonaEntrega },
      'No hay repartidores disponibles en la zona de entrega.'
    );
  }

  // Lista de repartidores simulados.
  const repartidores = [
    {
      idRepartidor: 101,
      nombre: 'Carlos',
      tiempoEstimado: 25,
    },
    {
      idRepartidor: 102,
      nombre: 'Andrés',
      tiempoEstimado: 30,
    },
    {
      idRepartidor: 103,
      nombre: 'Miguel',
      tiempoEstimado: 20,
    },
  ];

  // Seleccionar aleatoriamente un repartidor.
  const indice = Math.floor(
    Math.random() * repartidores.length
  );

  const repartidor = repartidores[indice];

  // Devolver la información que espera orquestador.js.
  return {
    idRepartidor: repartidor.idRepartidor,
    nombre: repartidor.nombre,
    tiempoEstimado: repartidor.tiempoEstimado,
  };
}

module.exports = {
  asignarRepartidorAsync,
};
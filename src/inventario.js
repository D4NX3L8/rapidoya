'use strict';

/**
 * inventario.js
 * -------------
 * RF-2: Validación de inventario de productos.
 *
 * En esta etapa se debe consultar la disponibilidad de cada producto en el pedido.
 *
 * Reglas clave:
 * 1. Las consultas por producto son independientes y deben ejecutarse en paralelo
 *    para optimizar los tiempos de respuesta.
 * 2. Estrategia Fail-Fast: Si la consulta de un solo producto falla (por red o
 *    por falta de stock), se debe rechazar y cancelar todo el pedido de inmediato,
 *    sin esperar a que terminen las demás verificaciones.
 */

const { delay, fallaConProbabilidad } = require('./simulador');
const { ErrorInventario } = require('./errores');

/**
 * Consulta de stock individual para un único producto.
 * Simula una llamada asíncrona a la base de datos o API de inventario.
 *
 * @param {object} producto - Objeto con la información del producto.
 * @param {string|number} producto.id - Identificador único del producto.
 * @param {string} [producto.nombre] - Nombre descriptivo del producto.
 * @param {number} producto.cantidad - Cantidad solicitada por el cliente.
 * @param {number} [producto.stockDisponible] - Cantidad disponible en stock.
 * @returns {Promise<object>} Objeto con la confirmación de verificación.
 */
const consultarStockProducto = async (producto) => {
    // Simula la latencia de red de la consulta
    await delay(200);

    // Simulación de fallo aleatorio de comunicación con el servicio de inventario (20% prob.)
    if (fallaConProbabilidad(0.2)) {
        throw new Error(`Fallo de conexión al verificar el producto: ${producto.nombre || producto.id}`);
    }

    // Validación de disponibilidad de stock
    const limiteStock = producto.stockDisponible ?? 10;
    if (producto.cantidad > limiteStock) {
        throw new Error(`Stock insuficiente para '${producto.nombre || producto.id}'. Solicitado: ${producto.cantidad}, Disponible: ${limiteStock}`);
    }

    return { id: producto.id, verificado: true };
};

/**
 * Orquesta la validación paralela de todo el listado de productos de un pedido (RF-2).
 *
 * @param {Array<object>} productos - Lista de productos que componen el pedido.
 * @returns {Promise<Array<object>>} Promesa que resuelve al arreglo de confirmaciones.
 * @throws {ErrorInventario} Si la lista es inválida o si falla la verificación de algún producto.
 */
const validarInventario = async (productos) => {
    // Validación de entrada para asegurar que recibimos una lista con elementos
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
        throw new ErrorInventario(
            productos,
            'El pedido no contiene una lista válida de productos para consultar inventario.'
        );
    }

    try {
        // Promise.all dispara todas las consultas en paralelo.
        // Si alguna promesa se rechaza, Promise.all falla inmediatamente (fail-fast),
        // cumpliendo con el requisito del negocio para esta etapa.
        const resultados = await Promise.all(
            productos.map((prod) => consultarStockProducto(prod))
        );

        return resultados;
    } catch (error) {
        // Empaqueta el fallo en la clase de error especializada exigida por la arquitectura
        throw new ErrorInventario(productos, error.message);
    }
};

module.exports = {
    validarInventario,
};
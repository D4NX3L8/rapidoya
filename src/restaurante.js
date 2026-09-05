/**
 * Simula el módulo heredado de verificación de restaurantes.
 * NO debe modificarse su firma: utiliza un callback.
 */
function verificarRestaurante(nombreRestaurante, alTerminar) {
    const tiempo = Math.floor(Math.random() * 1001) + 1000;

    setTimeout(() => {
        // 20% de probabilidad de que el restaurante falle
        if (Math.random() < 0.20) {
            const error = new Error(
                `El restaurante "${nombreRestaurante}" está cerrado o fuera de cobertura.`
            );

            alTerminar(error, null);
            return;
        }

        const restaurante = {
            nombre: nombreRestaurante,
            abierto: true,
            tiempoPreparacion: Math.floor(Math.random() * 31) + 15
        };

        alTerminar(null, restaurante);
    }, tiempo);
}


/**
 * Adaptador que convierte el callback heredado
 * en una Promise para poder utilizar async/await.
 */
function verificarRestauranteAsync(nombreRestaurante) {
    return new Promise((resolve, reject) => {
        verificarRestaurante(nombreRestaurante, (error, restaurante) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(restaurante);
        });
    });
}


module.exports = {
    verificarRestaurante,
    verificarRestauranteAsync
};